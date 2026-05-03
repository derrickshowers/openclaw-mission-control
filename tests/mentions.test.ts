import test from "node:test";
import assert from "node:assert/strict";

import {
  findMergedMentionPrefix,
  normalizeMentionText,
  splitTextWithMentions,
} from "@/lib/mentions";

test("normalizeMentionText repairs camel-case merged mentions in saved text", () => {
  assert.equal(
    normalizeMentionText("@michaelCan you move this?"),
    "@michael Can you move this?"
  );
  assert.equal(
    normalizeMentionText("@michaelcan you move this?"),
    "@michaelcan you move this?"
  );
});

test("findMergedMentionPrefix only allows lowercase merges when explicitly requested", () => {
  assert.deepEqual(findMergedMentionPrefix("michaelCan"), {
    agent: "michael",
    remainder: "Can",
  });
  assert.equal(findMergedMentionPrefix("michaelcan"), null);
  assert.deepEqual(
    findMergedMentionPrefix("michaelcan", { allowLowercaseWordMerges: true }),
    {
      agent: "michael",
      remainder: "can",
    }
  );
});

test("normalizeMentionText does not create false-positive short mentions", () => {
  assert.equal(normalizeMentionText("@tomcat deploy"), "@tomcat deploy");
  assert.equal(normalizeMentionText("@tomorrow maybe"), "@tomorrow maybe");
});

test("splitTextWithMentions preserves unmatched @ text and email addresses", () => {
  assert.deepEqual(splitTextWithMentions("foo @bar baz"), [
    { type: "text", value: "foo @bar baz" },
  ]);
  assert.deepEqual(splitTextWithMentions("email me@test.com"), [
    { type: "text", value: "email me@test.com" },
  ]);
});

test("splitTextWithMentions still highlights repaired mention tokens", () => {
  assert.deepEqual(splitTextWithMentions("ping @michaelCan please"), [
    { type: "text", value: "ping " },
    { type: "mention", value: "michael" },
    { type: "text", value: " Can please" },
  ]);
});
