// Shared types for the map data pipeline. Input is Overpass JSON (`out body; >; out skel qt;`).

export interface Bbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export type OsmElement = OsmNode | OsmWay;

export type PipelineStage = "fetch" | "validate" | "transform" | "emit";

export class PipelineError extends Error {
  readonly stage: PipelineStage;

  constructor(stage: PipelineStage, message: string) {
    super(`[${stage}] ${message}`);
    this.name = "PipelineError";
    this.stage = stage;
  }
}

export interface Building {
  id: number;
  footprint: [number, number][]; // local metres, ENU around the bbox centre
  heightM: number;
}

export interface Road {
  id: number;
  highway: string;
  oneway: boolean;
  points: [number, number][]; // local metres
}

export interface CityModel {
  origin: { lat: number; lon: number };
  buildings: Building[];
  roads: Road[];
  stats: { skipped: number };
}
