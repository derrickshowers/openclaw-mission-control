import test from "node:test";
import assert from "node:assert/strict";

import {
  findMergedMentionPrefix,
  normalizeMentionText,
  splitTextWithMentions,
} from "@/lib/mentions";

test("normalizeMentionText repairs camel-case and lowercase merged mentions", () => {
  assert.equal(
    normalizeMentionText("@michaelCan you move this?"),
    "@michael Can you move this?"
  );
  assert.equal(
    normalizeMentionText("@michaelcan you move this?"),
    "@michael can you move this?"
  );
});

test("findMergedMentionPrefix handles lowercase merge regressions without short false positives", () => {
  assert.deepEqual(findMergedMentionPrefix("michaelCan"), {
    agent: "michael",
    remainder: "Can",
  });
  assert.deepEqual(findMergedMentionPrefix("michaelcan"), {
    agent: "michael",
    remainder: "can",
  });
  assert.equal(findMergedMentionPrefix("tommy"), null);
});

test("splitTextWithMentions highlights repaired mention tokens", () => {
  assert.deepEqual(splitTextWithMentions("ping @michaelcan please"), [
    { type: "text", value: "ping " },
    { type: "mention", value: "michael" },
    { type: "text", value: " can please" },
  ]);
});
