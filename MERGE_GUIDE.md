# Resolving "Confirm current" and merging changes

If GitHub shows a "Resolve conflicts" banner for a pull request:

1. Click **Resolve conflicts** to open the conflict editor.
2. For each file, review the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Choose the version you want to keep or edit the file until the markers are gone.
4. When the file looks correct, click **Mark as resolved**.
5. Repeat for any remaining files, then click **Done**.

After every conflict is resolved, the button beneath the summary section changes to **Commit merge**. Click it to create the merge commit (or **Commit changes** if it is a fast-forward merge). If the button still says **Resolve conflicts**, double-check that no files are left unresolved.

Finally, return to the pull request conversation and click **Merge** ➝ **Confirm merge**. If the PR uses "Confirm current" (for conflict resolution) and the merge button is disabled, reload the page—GitHub only enables the merge button after the conflict-resolution commit is saved.
