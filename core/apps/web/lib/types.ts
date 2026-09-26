// Response shapes of the REST API (core/apps/http). Coordinates and sizes are in tiles.

export type Avatar = {
  id: string;
  name: string | null;
  imageUrl: string | null;
};

export type Me = {
  id: string;
  username: string;
  role: "Admin" | "User";
  avatar: Avatar | null;
};

export type MapSummary = {
  id: string;
  name: string;
  dimensions: string;
  thumbnail: string;
  tmjUrl: string | null;
};

export type SpaceSummary = {
  id: string;
  name: string;
  dimensions: string;
  thumbnail: string | null;
  mapId: string | null;
};

export type Element = {
  id: string;
  imageUrl: string;
  width: number;
  height: number;
  static: boolean;
};

export type SpaceElement = {
  id: string;
  element: Element;
  x: number;
  y: number;
};

export type SpaceDetail = {
  id: string;
  name: string;
  dimensions: string;
  mapId: string | null;
  tmjUrl: string | null;
  creatorId: string;
  elements: SpaceElement[];
};
