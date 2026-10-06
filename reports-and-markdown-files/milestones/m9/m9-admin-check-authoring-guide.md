# Creating JavaScript quiz and assignment checks

2026-10-02. New questions default to **Input/output problem**, with a private reference solution and generated tests. See [the input/output guide](m9-input-output-guide.md). Select **Coding** to use the legacy console/function controls described below; existing questions keep their type and values.

1. Add an assessment to a lesson. Enter its Arabic/English titles and instructions, and explicitly select required or optional.
2. For each coding question choose **Printed output (console.log)** or **Function return value**.
3. Choose the expected value type. The editor provides a text field, number field, true/false selector, null, object-property builder or array-item builder.
4. For function checks enter the function name and add each input separately, with its own value type. No array-of-arguments JSON is required.
5. Save the draft and publish the revision. Students must load that published revision before submitting against the new checks.

## Printed output

For console.log(2), choose Number and enter 2. For console.log("Hello"), choose Text and enter Hello without quotation marks. If several console.log calls are expected, choose Text and enter each printed line on its own line.

Console checking matches the complete displayed output. Numeric 2 and string "2" produce identical printed text; selecting a number input prevents accidental quotation entry but does not change this established grading contract. For strict type checking, objects and arrays, choose Function return value. Object/array options are unavailable for new console expectations because console object display is not a reliable structured-value comparison.

## Function returns, objects and arrays

For function sum(a,b) { return a+b; }, use function name sum; add two Number inputs, 2 and 3; select expected Number 5. Expected Text 5 is a different value and does not pass a numeric return.

For function build(n) { return { score:n, passed:true, labels:["ok",2] }; }, use function name build and Number input 5. Select expected Object and add:

- score: Number 5.
- passed: Boolean true.
- labels: Array with Text ok and Number 2.

Each property and array item has its own type. Add/remove controls support nested objects/arrays. Duplicate/empty property names and invalid numeric inputs block saving instead of silently publishing the previous valid value. Deep nesting beyond four visual levels uses a validated JSON field. The existing serialized-value limit remains 8192 characters.

Function checks compare complete values and types. Object property order is irrelevant; array order matters. Every configured check must pass. Expected values and function inputs remain private server-side checking content.

## Existing assessments

Existing numeric, string, boolean, null, object and array expectations reopen with their original type. No automatic string-to-number conversion, owner-quiz rewrite, grading-policy change or pass/history rewrite occurs. Private ADMIN code stays private unless explicitly shared as starter code. Changing a draft alone does not change the published checker.
