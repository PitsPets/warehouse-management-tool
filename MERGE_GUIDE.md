# Resolving "Confirm current" and merging changes

If GitHub shows a "Resolve conflicts" banner for a pull request:

1. Click **Resolve conflicts** to open the conflict editor.
2. For each file, review the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Choose the version you want to keep or edit the file until the markers are gone.
4. When the file looks correct, click **Mark as resolved**.
5. Repeat for any remaining files, then click **Done**.

After every conflict is resolved, the button beneath the summary section changes to **Commit merge**. Click it to create the merge commit (or **Commit changes** if it is a fast-forward merge). If the button still says **Resolve conflicts**, double-check that no files are left unresolved.

Finally, return to the pull request conversation and click **Merge** ➝ **Confirm merge**. If the PR uses "Confirm current" (for conflict resolution) and the merge button is disabled, reload the page—GitHub only enables the merge button after the conflict-resolution commit is saved.

## Skipping the web editor by accepting incoming changes locally

If the conflict is only about keeping the "incoming" (newer) version, run the helper script instead of using the GitHub UI:

```bash
# from the repository root
./scripts/accept-incoming.sh
```

The script automatically:

- Detects every file marked as conflicted (`git diff --diff-filter=U`)
- Checks out the incoming copy for each file (the same as clicking **Use incoming change** in the web editor)
- Stages the resolved files so you can review them with `git status`

Once the script finishes, confirm the result locally (e.g., with `git diff --staged`) and push the commit. When the branch is updated, GitHub will recognize that the conflict is gone so you can press **Merge** without opening the editor again.
