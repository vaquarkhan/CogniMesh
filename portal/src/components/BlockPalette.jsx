import { blocksByCategory } from "../lib/workflow-blocks";

export default function BlockPalette() {
  const categories = blocksByCategory();

  const onDragStart = (event, block) => {
    event.dataTransfer.setData("application/cognimesh-block", JSON.stringify(block));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="palette workflow-palette">
      <h2>Workflow blocks</h2>
      <p className="palette-hint">
        Drag AWS blocks: <strong>Kinesis, Glue, MSK, DMS, Firehose</strong> — ETL, ELT, enrichment, dedupe, streaming.
        Use Parallel / Choice / Merge for complex multi-domain pipelines.
      </p>

      {categories.map((cat) => (
        <div key={cat.id} className="palette-category">
          <h3 className="palette-category-title" title={cat.hint}>
            {cat.label}
          </h3>
          {cat.blocks.map((block) => (
            <div
              key={block.type}
              className={`palette-item palette-${block.defaults.blockType} palette-cat-${cat.id}`}
              draggable
              onDragStart={(e) => onDragStart(e, block)}
            >
              <span className="palette-label">{block.label}</span>
              <span className="palette-detail">{block.defaults.detail}</span>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

export { WORKFLOW_BLOCKS, PALETTE_BLOCKS } from "../lib/workflow-blocks";
