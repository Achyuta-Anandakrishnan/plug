type CardSpecSheetSection = {
  title: string;
  rows: Array<{ label: string; value: string | null | undefined }>;
};

type Props = {
  sections: CardSpecSheetSection[];
  className?: string;
};

export function CardSpecSheet({ sections, className = "" }: Props) {
  const visibleSections = sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter((row) => typeof row.value === "string" ? row.value.trim().length > 0 : Boolean(row.value)),
    }))
    .filter((section) => section.rows.length > 0);

  if (!visibleSections.length) return null;

  return (
    <div className={`card-spec-sheet ${className}`.trim()}>
      {visibleSections.map((section) => (
        <section key={section.title} className="card-spec-sheet-section">
          <h3 className="card-spec-sheet-title">{section.title}</h3>
          <dl className="card-spec-sheet-rows">
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.label}`} className="card-spec-sheet-row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
