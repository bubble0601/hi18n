import { Catalog, msg } from "@hi18n/core";
import type { Vocabulary } from ".";

export default new Catalog<Vocabulary>({
  "example/dynamic-todo": msg(),
  "example/greeting": msg("Hello, world!"),
  "example/greeting-todo-newtranslation": msg(),
  "example/greeting-todo2": msg(),
  // "example/greeting-unused": msg("Hello, world! (unused translation)"),
  "example/greeting-todo": msg("Hello, world! (TODO)"),
});
