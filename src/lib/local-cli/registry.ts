import { LOCAL_CLI_IDS, type LocalCliId } from "@/types/settings";

export type LocalCliDefinition = {
  id: LocalCliId;
  name: string;
  /** Arguments that print a model list, or null when the CLI cannot list models. */
  listModelsArgs: string[] | null;
  /**
   * Arguments that print one non-interactive answer for the prompt on stdin.
   * Everything that could read local files, run tools or join a session is
   * switched off: the CLI only ever sees the text this app pipes in.
   */
  printArgs: string[];
  /** Flag that selects one model, when the CLI accepts one. */
  modelFlag: string;
};

export const LOCAL_CLI_REGISTRY: LocalCliDefinition[] = [
  {
    id: "pi",
    name: "pi",
    listModelsArgs: ["--list-models"],
    printArgs: [
      "-p",
      "--no-tools",
      "--no-session",
      "--no-extensions",
      "--no-skills",
      "--no-context-files",
      "--mode",
      "text",
    ],
    modelFlag: "--model",
  },
  // `claude` has no model listing command; it falls back to its default model.
  // `--bare` is deliberately avoided: it would bypass the user's own OAuth/keychain login.
  {
    id: "claude",
    name: "claude",
    listModelsArgs: null,
    printArgs: ["-p", "--tools", "", "--output-format", "text"],
    modelFlag: "--model",
  },
];

export function findCliDefinition(id: string): LocalCliDefinition | null {
  return LOCAL_CLI_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export { LOCAL_CLI_IDS };
