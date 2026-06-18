import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PropertiesPanel from "./PropertiesPanel";

const sinkNode = {
  id: "sink-1",
  data: {
    label: "Iceberg Gold",
    blockType: "sink",
    targetType: "iceberg",
    location: "s3://lake/gold/",
    catalogDatabase: "gold",
    catalogTable: "orders",
  },
};

describe("PropertiesPanel", () => {
  it("renders RDS source fields without throwing", () => {
    const rdsNode = {
      id: "source-rds",
      data: {
        label: "RDS Orders",
        blockType: "source",
        sourceType: "rds",
        database: "orders_db",
        table: "orders",
        cdcEnabled: true,
        primaryKey: "order_id",
      },
    };
    render(
      <PropertiesPanel
        node={rdsNode}
        onChange={() => {}}
        pipelineMeta={{ name: "multi-source-mesh", domain: "commerce", version: "1.0.0" }}
        onMetaChange={() => {}}
      />
    );
    expect(screen.getByDisplayValue("orders_db")).toBeInTheDocument();
    expect(screen.getByDisplayValue("orders")).toBeInTheDocument();
  });

  it("renders sink encryption dropdown and updates value", () => {
    const onChange = vi.fn();
    render(
      <PropertiesPanel
        node={sinkNode}
        onChange={onChange}
        pipelineMeta={{ name: "test", domain: "commerce", version: "1.0.0" }}
        onMetaChange={() => {}}
      />
    );
    const select = screen.getByTestId("sink-encryption");
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "AES256" } });
    expect(onChange).toHaveBeenCalledWith("sink-1", { encryption: "AES256" });
  });

  it("shows Lake Formation toggle in pipeline settings", () => {
    const onMetaChange = vi.fn();
    render(
      <PropertiesPanel
        node={null}
        onChange={() => {}}
        pipelineMeta={{ name: "test", domain: "commerce", version: "1.0.0" }}
        onMetaChange={onMetaChange}
      />
    );
    const lf = screen.getByTestId("pipeline-enable-lake-formation");
    fireEvent.click(lf);
    expect(onMetaChange).toHaveBeenCalledWith(
      expect.objectContaining({ enableLakeFormation: true })
    );
  });

  it("shows Apply fix on AWS findings", () => {
    const onApply = vi.fn();
    render(
      <PropertiesPanel
        node={sinkNode}
        onChange={() => {}}
        pipelineMeta={{ name: "test", domain: "commerce", version: "1.0.0" }}
        onMetaChange={() => {}}
        awsFindings={[
          {
            id: "sec.s3_encryption.sink-1",
            severity: "high",
            title: "S3 encryption",
            message: "Enable encryption",
            fix: "Set AES256",
          },
        ]}
        onApplyFindingFix={onApply}
      />
    );
    fireEvent.click(screen.getByTestId("props-aws-apply-sec.s3_encryption.sink-1"));
    expect(onApply).toHaveBeenCalled();
  });
});
