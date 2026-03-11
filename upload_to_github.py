import subprocess
import json
import os
import hashlib
from datetime import datetime
from pathlib import Path

CONFIG_FILE = "git-upload-config.json"
CACHE_FILE = ".git-upload-cache.json"


def run(cmd_list):
    try:
        return subprocess.run(cmd_list, shell=False, check=True)
    except subprocess.CalledProcessError as e:
        print(f"❌ Error executing {' '.join(cmd_list)}: {e}")
        return None


def run_capture(cmd_list):
    try:
        return subprocess.check_output(cmd_list, shell=False).decode().strip()
    except:
        return None


def load_config():
    if not os.path.exists(CONFIG_FILE):
        print(f"❌ Error: {CONFIG_FILE} not found!")
        exit(1)
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_git_repo():
    if not Path(".git").exists():
        print("🚀 Initializing git repository...")
        run(["git", "init"])


def detect_branch(config):
    target_branch = config.get("default_branch", "main")
    run(["git", "branch", "-M", target_branch])
    return target_branch


def create_gitignore(patterns):
    gitignore = Path(".gitignore")
    print("📝 Syncing .gitignore with config patterns...")
    with open(gitignore, "w", encoding="utf-8") as f:
        for p in patterns:
            f.write(p + "\n")


def detect_large_files(limit_mb):
    print(f"🔍 Scanning for files larger than {limit_mb}MB...")
    limit = limit_mb * 1024 * 1024
    large_files_found = False

    for path in Path(".").rglob("*"):
        if ".git" in path.parts or "node_modules" in path.parts:
            continue
        if path.is_file():
            try:
                size = path.stat().st_size
                if size > limit:
                    print(
                        f"⚠️ Warning: Large file detected: {path} ({size / (1024*1024):.2f} MB)"
                    )
                    large_files_found = True
            except OSError:
                continue

    if large_files_found:
        confirm = input(
            "\n🚨 Large files detected! Do you want to continue anyway? (y/n): "
        )
        if confirm.lower() != "y":
            print("❌ Upload cancelled.")
            exit(1)


def apply_gitignore_smartly():
    print("🧹 Updating Git index...")
    try:
        # ใส่ -c เพื่อแก้บั๊ก fatal: ls-files
        ignored_but_tracked = run_capture(
            ["git", "ls-files", "-i", "-c", "--exclude-standard"]
        )
        if ignored_but_tracked:
            files_to_remove = ignored_but_tracked.splitlines()
            for file_path in files_to_remove:
                if file_path.strip():
                    run(["git", "rm", "--cached", "-r", "--ignore-unmatch", file_path])
        run(["git", "add", "-A"])
        print("✅ Git index updated successfully.")
    except Exception as e:
        print(f"❌ Error: {e}")


def commit_preview():
    print("\n--- Current Git Status ---")
    run(["git", "status", "-s"])
    print("\n--- Changes Summary ---")
    # นำ diff กลับเข้ามาไว้ในฟังก์ชันนี้
    run(["git", "--no-pager", "diff", "--cached", "--stat"])


def commit(config):
    status = run_capture(["git", "status", "--porcelain"])
    if not status:
        print("✨ Nothing has changed (Nothing to commit)")
        return False

    print("📝 Creating a commit...")
    message = config.get("auto_commit_message", "🤖 Auto commit").format(
        date=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

    if config.get("ask_for_message"):
        custom_message = input(
            f"💬Enter Commit text (press Enter to use'{message}'): "
        ).strip()
        if custom_message:
            message = custom_message

    run(["git", "commit", "-m", message])
    return True


def push(remote, branch):
    print(f"\n🚀 Pushing to {remote}/{branch}...")

    # รันแบบไม่บล็อกหน้าจอ เพื่อให้ Git ถามรหัสผ่าน/SSH ได้เหมือนเดิม
    result = subprocess.run(["git", "push", "-u", remote, branch])

    # ถ้า Push ล้มเหลว (เกิด Error หรือโดน Rejected)
    if result.returncode != 0:
        print("\n⚠️ Push failed!")
        print(
            "Possible reasons: 1) Wrong password/key entered or 2) Information on GitHub is newer (Rejected)"
        )

        confirm_pull = input(
            "\n❓ If you think you've been rejected because your data is older, do you want to pull it down first? (y/n): "
        )
        if confirm_pull.lower() == "y":
            print(f"📥 is Pulling...")
            subprocess.run(["git", "pull", remote, branch])

            # เช็ก Conflict
            status = run_capture(["git", "status"])
            if status and (
                "unmerged paths" in status
                or "fix conflicts" in status
                or "conflict" in status.lower()
            ):
                print("\n🚨 There is a conflict in the file!")
                print("1) Use all our 'new code' (Ours)")
                print("2) Use all 'old code' from GitHub (Theirs)")
                print("3) I'll go fix it myself (Manual)")

                choice = input("👉 Select management method (1/2/3): ")
                if choice == "1":
                    run(["git", "checkout", "--ours", "."])
                    run(["git", "add", "."])
                    run(
                        [
                            "git",
                            "commit",
                            "-m",
                            "✅ Resolved conflicts using our changes",
                        ]
                    )
                elif choice == "2":
                    run(["git", "checkout", "--theirs", "."])
                    run(["git", "add", "."])
                    run(
                        [
                            "git",
                            "commit",
                            "-m",
                            "✅ Resolved conflicts using remote changes",
                        ]
                    )
                else:
                    print(
                        "🛠️ Please correct conflicts in the file and run the program again"
                    )
                    return False

            print("🔄 Trying Push again...")
            retry = subprocess.run(["git", "push", "-u", remote, branch])
            return retry.returncode == 0

        return False

    return True


def main():
    try:
        config = load_config()
        ensure_git_repo()
        create_gitignore(config["ignore_patterns"])

        remote_name = config.get("remote_name", "origin")
        remote_url = run_capture(["git", "remote", "get-url", remote_name])

        if not remote_url:
            print(f"❌ Could not find Remote with name '{remote_name}'")
            url_input = input("🔗 Please enter the Git Remote URL: ").strip()
            if url_input:
                run(["git", "remote", "add", remote_name, url_input])
                remote_url = url_input
            else:
                return

        detect_large_files(config["large_file_limit_mb"])
        apply_gitignore_smartly()
        commit_preview()

        print(f"\n⚠️ About to send code to: {remote_url}")
        confirm = input("❓ Confirm Commit and Push or not? (y/n): ")

        if confirm.lower() == "y":
            is_committed = commit(config)

            # ยอมให้ Push ได้เสมอ เผื่อรอบก่อน Push ติด Error แล้วอยากดันซ้ำ
            if push(remote_name, detect_branch(config)):
                print("\n✅ Operation completed!")
            else:
                print("\n❌ Push was canceled or failed")
        else:
            print("❌ Cancel operation")

    except Exception as e:
        print(f"❌ Error: {e}")
    except KeyboardInterrupt:
        print("\n\n👋 Close program by user")


if __name__ == "__main__":
    main()
