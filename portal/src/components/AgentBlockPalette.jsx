import { agentBlocksByCategory } from "../lib/agent-blocks";

export default function AgentBlockPalette() {
  const categories = agentBlocksByCategory();

  const onDragStart = (event, block) => {
    event.dataTransfer.setData("application/cognimesh-agent-block", JSON.stringify(block));
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="palette agent-palette">
      <h2>AgentCore blocks</h2>
      <p className="palette-hint">
        Drag <strong>Runtime, Gateway, Guardrails, KB, Memory, Tools</strong> onto the canvas.
        Wire blocks to Runtime or Gateway — guardrails attach to Runtime.
      </p>

      {categories.map((cat) => (
        <div key={cat.id} className="palette-category">
          <h3 className="palette-category-title" title={cat.hint}>
            {cat.label}
          </h3>
          {cat.blocks.map((block) => (
            <div
              key={block.type}
              className={`palette-item agent-palette-item agent-block-${block.defaults.blockType}`}
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
