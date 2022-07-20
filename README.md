# Alt8
![Test](https://github.com/maksimr/vscode-alt8/workflows/Test/badge.svg)
[![Open in Gitpod](https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-%230092CF.svg)](https://gitpod.io/#https://github.com/maksimr/vscode-alt8)

Provides functionality to [jump to an "alternate" file](https://github.com/tpope/vim-projectionist#alternate-files),
based on ye olde convention originally established in VSCode settings or `.projections.json`.
Here's an example configuration for Maven that allows you to jump between the implementation and test:

```json
{
  "src/main/java/*.java": {"alternate": "src/test/java/{}.java"},
  "src/test/java/*.java": {"alternate": "src/main/java/{}.java"}
}
```