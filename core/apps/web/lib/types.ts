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

// Public spaces are listed in Explore; private ones need an invite link
export type Visibility = "Public" | "Private";

export type SpaceSummary = {
  id: string;
  name: string;
  dimensions: string;
  thumbnail: string | null;
  mapId: string | null;
  visibility: Visibility;
};

// One of the caller's own spaces (GET /space/all)
export type OwnedSpaceSummary = SpaceSummary & {
  inviteCode: string;
};

// A space owned by someone else: joined (with lastVisitedAt) or listed in Explore (lastVisitedAt null)
export type OtherSpaceSummary = SpaceSummary & {
  ownerUsername: string;
  lastVisitedAt: string | null;
};

export type InvitePreview = {
  spaceId: string;
  name: string;
  dimensions: string;
  thumbnail: string | null;
  ownerUsername: string;
  visibility: Visibility;
  isOwner: boolean;
  // Already joined (through an invite or a public visit)
  isMember: boolean;
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
  visibility: Visibility;
  // Only sent to the owner
  inviteCode?: string;
  elements: SpaceElement[];
};
