# Repository instructions

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

## Local Docker data

After cloning on Windows, use `workspace/scripts/dev-docker.ps1 -RestoreData` to import the bundled sample data and start the Docker stack. The script prefers a local private snapshot in `workspace/src/data-backup/` when one is present. Use `-BackupPath` to select a specific ZIP. Keep existing populated databases intact. See [the restore procedure](workspace/src/data-backup/README.md).
