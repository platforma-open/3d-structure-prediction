---
'@platforma-open/milaboratories.3d-structure-prediction': patch
---

Pass `--registry-serve-url` when publishing the block

The release run failed at the facade's `prepublishOnly`:

```
> block-tools pack && block-tools publish -r 's3://…/pub/releases/?region=eu-central-1'
error: required option '--registry-serve-url <url>' not specified
```

`block-tools` made `--registry-serve-url` a required option for `publish`, and the script
predates that. The block was bumped from block-tools 2.11.0 to 2.14.3 in the previous release,
which is what surfaced it — the component packages published to npm first, then the facade failed,
so the block itself was never published at that version.

The script now matches the form the already-migrated blocks use, `--registry-serve-url
https://blocks.pl-open.science` included.

The redundant `block-tools pack &&` prefix goes with it: `build` already runs
`shx rm -rf ./block-pack && block-tools pack`, and CI publishes with `build-script-name: 'build'`,
so the pack had already happened by the time `prepublishOnly` fired.

This changeset exists to produce a version bump, so the release pipeline runs again and actually
publishes the block.
