export function unansweredChoices(
  questions: ReadonlyArray<{ id: string; type: string; choices?: ReadonlyArray<{ id: string }> }>,
  answers: ReadonlyArray<{ questionId: string; choiceId?: string }>,
): string[] {
  return questions
    .filter((question) => {
      if (question.type !== 'CHOICE') return false;
      const selected = answers.find((answer) => answer.questionId === question.id)?.choiceId;
      return !selected || !question.choices?.some((choice) => choice.id === selected);
    })
    .map((question) => question.id);
}
