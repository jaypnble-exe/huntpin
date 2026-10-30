import { Suspense } from "react";
import { PlacesExplorer } from "./PlacesExplorer";

export default function Home() {
  return (
    <Suspense>
      <PlacesExplorer />
    </Suspense>
  );
}
