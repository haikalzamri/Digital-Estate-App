type ModuleStageProps = {
  title: string;
  label: string;
};

export function ModuleStage({ title, label }: ModuleStageProps) {
  return (
    <section className="module-stage" aria-labelledby="module-stage-title">
      <div className="section-heading">
        <p>{label}</p>
        <h2 id="module-stage-title">{title}</h2>
      </div>
      <div className="stage-grid" aria-hidden="true">
        <div />
        <div />
        <div />
      </div>
      <div className="stage-body" aria-hidden="true" />
    </section>
  );
}
