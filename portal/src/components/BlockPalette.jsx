const PALETTE_BLOCKS = [
  {
    type: "source",
    label: "Source",
    defaults: {
      label: "Source",
      blockType: "source",
      sourceType: "rds",
      database: "orders_db",
      table: "orders",
      cdcEnabled: true,
      primaryKey: "order_id",
      detail: "rds · CDC",
    },
  },
  {
    type: "transform",
    label: "Transform",
    defaults: {
      label: "Transform",
      blockType: "transform",
      transformType: "spark_sql",
      executionMode: "batch",
      schedule: "0 */6 * * *",
      sparkSql: "SELECT * FROM bronze.orders",
      detail: "spark_sql",
    },
  },
  {
    type: "transform-agentic",
    label: "AI Transform",
    defaults: {
      label: "AI Transform",
      blockType: "transform",
      transformType: "agentic",
      executionMode: "stream",
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      promptTemplate: "Extract structured entities from the provided media.",
      compensationHandler: "cognimesh.compensation.media-rollback",
      detail: "agentic · Bedrock",
    },
  },
  {
    type: "sink",
    label: "Sink",
    defaults: {
      label: "Sink",
      blockType: "sink",
      targetType: "iceberg",
      location: "s3://cognimesh-dev-gold/portal-output/",
      catalogDatabase: "portal_gold",
      catalogTable: "output",
      detail: "iceberg",
    },
  },
];

export default function BlockPalette() {
  const onDragStart = (event, block) => {
    event.dataTransfer.setData("application/cognimesh-block", JSON.stringify(block));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="palette">
      <h2>Blocks</h2>
      <p className="palette-hint">Drag blocks onto the canvas</p>
      {PALETTE_BLOCKS.map((block) => (
        <div
          key={block.type}
          className={`palette-item palette-${block.defaults.blockType}`}
          draggable
          onDragStart={(e) => onDragStart(e, block)}
        >
          <span className="palette-label">{block.label}</span>
          <span className="palette-detail">{block.defaults.detail}</span>
        </div>
      ))}
    </aside>
  );
}

export { PALETTE_BLOCKS };
