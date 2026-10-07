export { createParentReportsRouter } from './routes.js';
export type { ParentReportsDeps } from './routes.js';
export { postgresViewFactsReader, type ViewFactsReader, type SessionRow } from './viewFacts.js';
export {
  courseRoster,
  lessonCoverage,
  reportCourses,
  studentCourseViews,
  eligibleCoursesForStudent,
  type RosterPage,
  type RosterRow,
} from './reportService.js';
export { generateParentReport, MAX_GENERATE_COURSES, type GenerateInput, type GenerateOutput } from './reportServer.js';
export { renderParentReport, toParts, weekSections, cairoDate, REPORT_DAYS } from './text.js';
