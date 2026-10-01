# JavaScript input/output problems

2026-10-02. Owner-authorized Codeforces-style input/output authoring within M9. Existing function/console and multiple-choice assessments remain supported; existing quizzes and passes are not converted.

## Create a problem

1. Open the lesson's **Assignments and quizzes**, then **Add assessment**. New coding questions default to **Input/output problem**.
2. Write Arabic/English titles, instructions, input format and output format. Select required or optional explicitly.
3. Add one to three public input/output examples. These are visible to students.
4. Enter a **private reference solution** that reads with `readline()` and prints with `console.log()`. This is separate from the optional student starter code. Do not share your solution as starter code.
5. Choose an input generator. **Integers in a range** includes useful boundaries and seeded values automatically. For several values, strings, arrays, objects or multiline inputs, select **Custom JavaScript generator**; it must print one JSON array containing up to 16 input strings.
6. Save the draft, select **Prepare and review tests**, wait for completion, and inspect the private generated inputs/outputs. Fix a failed reference, generator or public example and prepare again.
7. Publish the revision. The prepared tests are frozen in that revision. Editing a saved draft requires fresh preparation before republishing; the previous published version and earned passes remain intact.

For the square problem, select integer inputs from -10 to 10 and use this reference:

```javascript
const n = Number(readline());
console.log(n ** 2);
```

The public example can be input `3`, output `9`. Generated expected outputs come from your reference; you do not need to enter each answer. A student's hardcoded `console.log(9)` fails other inputs.

For two numbers on separate lines, a custom generator can generate many inputs without manually providing outputs:

```javascript
const inputs = [];
for (let n = -5; n <= 5; n++) inputs.push(`${n}\n${n + 1}`);
console.log(JSON.stringify(inputs));
```

The corresponding reference reads two lines and prints their sum. For array/object input, encode each input as a JSON string and parse `readline()` in the reference and student program.

## Student experience

Read the public examples, write JavaScript, enter a local input, and select **Run** to see the console output. `readline()` returns one line per call and `undefined` at end of input; CRLF is normalized. Select **Submit** for official grading against the frozen private tests. Changing the local input does not change those tests. Exercise Runs do not consume the standalone practice allowance. Reset, highlighting, Prettier, drafts, unlimited retries and required/optional progression remain available.

Programs in this mode are synchronous. External libraries/network and asynchronous timers are not supported. Print only the requested answer, without debug messages or prompts. For structured output, use `console.log(JSON.stringify(value))`, rather than logging a browser object directly.

## Output comparison

- **Tokens:** compare whitespace-separated strings exactly; whitespace differences are ignored. `2` and `2.0` are different tokens; no floating-point tolerance is implied.
- **Exact text:** normalize line endings and ignore trailing whitespace; other whitespace is significant.
- **JSON:** parse one complete JSON value and compare types/values deeply. Object key order is irrelevant; array order is significant. Extra output or a string where a number is required fails.

## Preparation and isolation

Express validates/stores the private draft and accepts a durable preparation receipt. Only the trusted grading controller launches reference/generator code in restricted disposable execution containers, using the existing grading isolation. Each input runs in a fresh browser page. The reference is executed twice per input; differing results fail preparation. Every public example must match. This is a consistency check, not proof that a reference or finite tests cover every possible input: the admin must review the problem and generated cases.

Limits: 20 frozen input/output cases total per assessment; 8192 characters per input/output; 32,768 characters per reference/generator source; bounded private preparation result and the existing execution deadline/resources. Integer generation uses up to the requested count, bounded by distinct values in the range; duplicate generated/sample inputs collapse. Preparation admission is bounded to 32 outstanding jobs globally, with one preparation executor per controller. These limits are resource controls, not an educational retry cap or a 10,000-user throughput certificate.

The source, generator and private tests never enter student API responses. Published versions store frozen tests without the reference or generator. Draft/preparation snapshots remain admin-only; terminal preparation history expires after 180 days. Course/assessment permanent deletion cascades the associated private records. No DRM changes or production deployment are involved.
