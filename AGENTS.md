# Repository instructions

<!-- postman-cli:installation:start -->
Postman CLI is installed on this device, and can be used for API Engineering work.
<!-- postman-cli:installation:end -->

## Local Docker data

When asked to set up this project on a new machine or to restore its working data, check `workspace/src/data-backup/` before starting the full stack. If the local PostgreSQL volume is new and a backup ZIP is present, follow [the restore procedure](workspace/src/data-backup/README.md) so that the snapshot is loaded before the seed/bootstrap service runs. Keep existing populated databases intact. If the machine only has a Git checkout, the private backup must be copied into this directory separately.
