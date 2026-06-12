import { createNodeFromType } from "../features/nodes/nodeFactory";
import type { GraphLink, GraphNode } from "../types";

export interface LargeCanvasFixtureOptions {
  imageNodes?: number;
  textNodes?: number;
  videoNodes?: number;
}

export interface LargeCanvasFixture {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DEFAULT_IMAGE_COUNT = 40;
const DEFAULT_TEXT_COUNT = 12;
const DEFAULT_VIDEO_COUNT = 24;
const COLUMN_GAP = 680;
const ROW_GAP = 420;
const ROW_SIZE = 8;

function getNodePosition(index: number, columnOffset: number) {
  return {
    x: columnOffset + (index % ROW_SIZE) * COLUMN_GAP,
    y: Math.floor(index / ROW_SIZE) * ROW_GAP,
  };
}

function createFixtureTextNode(index: number): GraphNode {
  const position = getNodePosition(index, 0);
  const node = createNodeFromType("text_node", `fixture_text_${index}`, position.x, position.y);
  return {
    ...node,
    title: `Fixture Text ${index + 1}`,
    properties: {
      ...node.properties,
      text: `Describe shot ${index + 1} for a large canvas performance fixture.`,
      response: `Fixture prompt ${index + 1}`,
      status: "success",
    },
    data: {
      ...node.data,
      response: `Fixture prompt ${index + 1}`,
      textNodeWidth: 420,
      textNodeHeight: 220,
    },
  };
}

function createFixtureImageNode(index: number, textCount: number): GraphNode {
  const position = getNodePosition(index, 220);
  const imageUrl = `https://example.com/aistudio-fixtures/images/image-${index + 1}.webp`;
  const node = createNodeFromType("image_node", `fixture_image_${index}`, position.x, position.y);
  return {
    ...node,
    title: `Fixture Image ${index + 1}`,
    properties: {
      ...node.properties,
      imageUrl,
      text: `Image node ${index + 1} generated from fixture text ${(index % Math.max(1, textCount)) + 1}.`,
      status: "success",
    },
    data: {
      ...node.data,
      imageUrl,
      imageUrls: [imageUrl],
      imageNodeWidth: 360,
      imageNodeHeight: 240,
      imageNaturalWidth: 1280,
      imageNaturalHeight: 720,
      imageDisplayWidth: 360,
      imageDisplayHeight: 203,
      imagePortCenterY: 120,
      isSourceNode: true,
    },
  };
}

function createFixtureVideoNode(index: number, imageCount: number): GraphNode {
  const position = getNodePosition(index, 440);
  const videoUrl = `https://example.com/aistudio-fixtures/videos/video-${index + 1}.mp4`;
  const node = createNodeFromType("video_node", `fixture_video_${index}`, position.x, position.y);
  return {
    ...node,
    title: `Fixture Video ${index + 1}`,
    properties: {
      ...node.properties,
      videoUrl,
      text: `Video node ${index + 1} generated from fixture image ${(index % Math.max(1, imageCount)) + 1}.`,
      status: "success",
    },
    data: {
      ...node.data,
      videoUrl,
      videoNodeWidth: 360,
      videoNodeHeight: 240,
      videoNaturalWidth: 1280,
      videoNaturalHeight: 720,
      videoDisplayWidth: 360,
      videoDisplayHeight: 203,
      videoPortCenterY: 120,
      videoDuration: 5,
      isSourceNode: true,
    },
  };
}

function createLink(
  id: string,
  fromNodeId: string,
  fromOutputIndex: number,
  toNodeId: string,
  toInputIndex: number
): GraphLink {
  return { id, fromNodeId, fromOutputIndex, toNodeId, toInputIndex };
}

export function createLargeCanvasFixture(
  options: LargeCanvasFixtureOptions = {}
): LargeCanvasFixture {
  const textCount = Math.max(0, Math.floor(options.textNodes ?? DEFAULT_TEXT_COUNT));
  const imageCount = Math.max(0, Math.floor(options.imageNodes ?? DEFAULT_IMAGE_COUNT));
  const videoCount = Math.max(0, Math.floor(options.videoNodes ?? DEFAULT_VIDEO_COUNT));

  const textNodes = Array.from({ length: textCount }, (_, index) => createFixtureTextNode(index));
  const imageNodes = Array.from({ length: imageCount }, (_, index) =>
    createFixtureImageNode(index, textCount)
  );
  const videoNodes = Array.from({ length: videoCount }, (_, index) =>
    createFixtureVideoNode(index, imageCount)
  );

  const links: GraphLink[] = [];
  imageNodes.forEach((imageNode, index) => {
    if (textCount === 0) return;
    links.push(createLink(`fixture_link_text_image_${index}`, `fixture_text_${index % textCount}`, 0, imageNode.id, 1));
  });
  videoNodes.forEach((videoNode, index) => {
    if (imageCount > 0) {
      links.push(createLink(`fixture_link_image_video_${index}`, `fixture_image_${index % imageCount}`, 0, videoNode.id, 1));
      return;
    }
    if (textCount > 0) {
      links.push(createLink(`fixture_link_text_video_${index}`, `fixture_text_${index % textCount}`, 0, videoNode.id, 0));
    }
  });

  return {
    nodes: [...textNodes, ...imageNodes, ...videoNodes],
    links,
  };
}
