import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumber, findNumber } from "./phone.ts";

test("London landline in any form", () => {
  for (const input of ["020 7946 0123", "+44 20 7946 0123", "0044 (0)20 7946 0123", "442079460123", "2079460123"]) {
    const n = parseNumber(input);
    assert.equal(n.key, "02079460123", input);
    assert.equal(n.display, "020 7946 0123");
    assert.equal(n.international, "+44 20 7946 0123");
    assert.equal(n.kind, "landline");
    assert.equal(n.label, "UK landline · London");
    assert.equal(n.fictional, true);
  }
});

test("kinds of UK number", () => {
  assert.equal(parseNumber("07912 345678").kind, "mobile");
  assert.equal(parseNumber("07912 345678").display, "07912 345678");
  assert.equal(parseNumber("07012 345678").kind, "personal");
  assert.equal(parseNumber("07624 123456").label, "Mobile · Isle of Man");
  assert.equal(parseNumber("0800 123 4567").kind, "freephone");
  assert.equal(parseNumber("0300 123 4567").kind, "non-geographic");
  assert.equal(parseNumber("0845 123 4567").kind, "business-rate");
  assert.equal(parseNumber("0909 123 4567").kind, "premium");
  assert.equal(parseNumber("0161 496 0000").label, "UK landline · Manchester");
  assert.equal(parseNumber("0161 496 0000").display, "0161 496 0000");
  assert.equal(parseNumber("01632 960555").label, "UK landline · geographic number");
  assert.equal(parseNumber("01632 960555").fictional, true);
  assert.equal(parseNumber("01632 961555").fictional, false);
});

test("international and invalid", () => {
  const us = parseNumber("+1 202 555 0143");
  assert.equal(us.kind, "international");
  assert.equal(us.label, "International · USA or Canada");
  assert.equal(us.display, "+1 202 555 0143");
  assert.equal(parseNumber("+234 803 123 4567").label, "International · Nigeria");
  assert.equal(parseNumber("12345").kind, "invalid");
  assert.equal(parseNumber("").kind, "invalid");
  assert.equal(parseNumber("0612 345678").kind, "invalid");
});

test("finds a number in shared text", () => {
  assert.equal(findNumber("Missed call from 07700 900123 at 10:02"), "07700 900123");
  assert.equal(findNumber("tel:+442079460123"), "+442079460123");
  assert.equal(findNumber("hello"), null);
});
