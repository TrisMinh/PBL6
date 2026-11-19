# Repository instructions

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

## Local Docker data

After cloning on Windows, use `workspace/scripts/dev-docker.ps1 -RestoreData` to import the private snapshot and start the Docker stack. Look for the ZIP in `workspace/src/data-backup/` or use `-BackupPath` if it is stored elsewhere. Keep existing populated databases intact. See [the restore procedure](workspace/src/data-backup/README.md).
