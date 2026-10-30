import { Suspense } from "react";
import { PipelineBoard } from "./PipelineBoard";

export default function PipelinePage() {
  return (
    <Suspense>
      <PipelineBoard />
    </Suspense>
  );
}
