// ============================================================
// ZEUS — Git Commands
// ============================================================
// Replaces: src/main/ipc/handlers/git.handler.ts
// All git operations via Command::new("git") — no JS library needed.
// ============================================================

use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

// ── Types ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub staged: bool,
    pub working: String,
    pub index: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    pub ahead: i64,
    pub behind: i64,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<GitFileStatus>,
    pub is_clean: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitDiff {
    pub file_path: String,
    pub diff: String,
    pub additions: usize,
    pub deletions: usize,
}

// ── Helper ───────────────────────────────────────────────────

fn git(repo_path: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("git not found: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(stderr.trim().to_string())
    }
}

fn git_ok(repo_path: &str, args: &[&str]) -> Result<bool, String> {
    git(repo_path, args).map(|_| true)
}

// ── Commands ─────────────────────────────────────────────────

#[tauri::command]
pub async fn git_status(repo_path: String) -> Result<Option<GitStatus>, String> {
    // Get porcelain v1 status
    let status_out = match git(&repo_path, &["status", "--porcelain=v1", "-u"]) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };

    // Get current branch
    let branch = git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "HEAD".to_string());

    // Get ahead/behind
    let (ahead, behind) = git(&repo_path, &[
        "rev-list", "--left-right", "--count", "@{u}...HEAD",
    ])
    .map(|s| {
        let parts: Vec<&str> = s.trim().split_whitespace().collect();
        let behind = parts.first().and_then(|p| p.parse::<i64>().ok()).unwrap_or(0);
        let ahead = parts.get(1).and_then(|p| p.parse::<i64>().ok()).unwrap_or(0);
        (ahead, behind)
    })
    .unwrap_or((0, 0));

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for line in status_out.lines() {
        if line.len() < 3 {
            continue;
        }
        let xy = &line[..2];
        let file_path = line[3..].trim().to_string();
        let x = &xy[..1]; // index (staged) status
        let y = &xy[1..]; // working tree status

        if x == "?" && y == "?" {
            untracked.push(GitFileStatus {
                path: file_path,
                staged: false,
                working: "??".to_string(),
                index: "??".to_string(),
            });
        } else {
            // Staged changes
            if x != " " && x != "?" {
                staged.push(GitFileStatus {
                    path: file_path.clone(),
                    staged: true,
                    working: " ".to_string(),
                    index: x.to_string(),
                });
            }
            // Unstaged changes
            if y != " " && y != "?" {
                unstaged.push(GitFileStatus {
                    path: file_path,
                    staged: false,
                    working: y.to_string(),
                    index: " ".to_string(),
                });
            }
        }
    }

    let is_clean = staged.is_empty() && unstaged.is_empty() && untracked.is_empty();

    Ok(Some(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        is_clean,
    }))
}

#[tauri::command]
pub async fn git_init(repo_path: String) -> Result<bool, String> {
    git_ok(&repo_path, &["init"])
}

#[tauri::command]
pub async fn git_stage(repo_path: String, files: Vec<String>) -> Result<bool, String> {
    let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    let mut args = vec!["add", "--"];
    args.extend(file_refs.iter().copied());
    git_ok(&repo_path, &args)
}

#[tauri::command]
pub async fn git_unstage(repo_path: String, files: Vec<String>) -> Result<bool, String> {
    for file in &files {
        let _ = git(&repo_path, &["reset", "HEAD", "--", file]);
    }
    Ok(true)
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<bool, String> {
    git_ok(&repo_path, &["commit", "-m", &message])
}

#[tauri::command]
pub async fn git_push(repo_path: String) -> Result<bool, String> {
    git_ok(&repo_path, &["push"])
}

#[tauri::command]
pub async fn git_pull(repo_path: String) -> Result<bool, String> {
    git_ok(&repo_path, &["pull"])
}

#[tauri::command]
pub async fn git_fetch(repo_path: String) -> Result<bool, String> {
    git_ok(&repo_path, &["fetch"])
}

#[tauri::command]
pub async fn git_branches(repo_path: String) -> Result<Vec<GitBranch>, String> {
    let output = git(&repo_path, &["branch", "-a", "--format=%(refname:short) %(HEAD)"])?;
    let current_branch = git(&repo_path, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    let branches = output
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() {
                return None;
            }
            let parts: Vec<&str> = line.splitn(2, ' ').collect();
            let name = parts[0].to_string();
            let is_remote = name.starts_with("remotes/") || name.starts_with("origin/");
            Some(GitBranch {
                current: name == current_branch || parts.get(1).map_or(false, |s| *s == "*"),
                remote: if is_remote { Some(name.clone()) } else { None },
                name: name.trim_start_matches("remotes/").to_string(),
            })
        })
        .collect();

    Ok(branches)
}

#[tauri::command]
pub async fn git_checkout(repo_path: String, branch: String) -> Result<bool, String> {
    git_ok(&repo_path, &["checkout", &branch])
}

#[tauri::command]
pub async fn git_diff(
    repo_path: String,
    file_path: Option<String>,
) -> Result<Vec<GitDiff>, String> {
    let raw = if let Some(ref fp) = file_path {
        // Get relative path for git diff
        let rel = Path::new(fp)
            .strip_prefix(Path::new(&repo_path))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| fp.clone());
        git(&repo_path, &["diff", "HEAD", "--", &rel]).unwrap_or_default()
    } else {
        git(&repo_path, &["diff", "HEAD"]).unwrap_or_default()
    };

    let additions = raw.lines().filter(|l| l.starts_with('+') && !l.starts_with("+++")).count();
    let deletions = raw.lines().filter(|l| l.starts_with('-') && !l.starts_with("---")).count();

    Ok(vec![GitDiff {
        file_path: file_path.unwrap_or_else(|| repo_path.clone()),
        diff: raw,
        additions,
        deletions,
    }])
}

#[tauri::command]
pub async fn git_log(repo_path: String, limit: Option<usize>) -> Result<Vec<GitCommit>, String> {
    let limit_str = limit.unwrap_or(50).to_string();
    let format = "%H\x1F%s\x1F%an\x1F%ai";
    let output = git(
        &repo_path,
        &["log", &format!("-{}", limit_str), &format!("--format={}", format)],
    )?;

    let commits = output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(4, '\x1F').collect();
            if parts.len() == 4 {
                Some(GitCommit {
                    hash: parts[0].to_string(),
                    message: parts[1].to_string(),
                    author: parts[2].to_string(),
                    date: parts[3].to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
pub async fn git_clone(url: String, dest_path: String) -> Result<bool, String> {
    let parent = Path::new(&dest_path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string());

    let output = Command::new("git")
        .args(["clone", &url, &dest_path])
        .current_dir(&parent)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(true)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
