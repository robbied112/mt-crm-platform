/**
 * SectionRenderer — dispatches to the correct section component by type.
 */
import KpiRowSection from "./sections/KpiRowSection";
import ChartSection from "./sections/ChartSection";
import TableSection from "./sections/TableSection";
import TextSection from "./sections/TextSection";
import GridSection from "./sections/GridSection";

export default function SectionRenderer({ section }) {
  if (!section) return null;

  switch (section.type) {
    case "kpiRow":
      return <KpiRowSection section={section} />;
    case "chart":
      return <ChartSection section={section} />;
    case "table":
      return <TableSection section={section} />;
    case "text":
      return <TextSection section={section} />;
    case "grid":
      return <GridSection section={section} />;
    default:
      return null;
  }
}
