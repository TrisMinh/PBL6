# Repository instructions

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

## Local Docker data

When asked to set up this project on a new Windows machine, use [Setup-PBL6.ps1](Setup-PBL6.ps1). Check `workspace/src/data-backup/` for the private snapshot so it can be imported before the seed/bootstrap service runs. Keep existing populated databases intact. If the machine only has a Git checkout, the private backup must be transferred separately. See [the restore procedure](workspace/src/data-backup/README.md).
