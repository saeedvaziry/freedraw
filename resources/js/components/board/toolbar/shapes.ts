import {
  Circle,
  Cloud,
  Cylinder,
  Diamond,
  Heart,
  Hexagon,
  RectangleHorizontal,
  Square,
  Star,
  Triangle,
  type LucideIcon,
} from 'lucide-react'
import { ParallelogramIcon } from './icons.js'

export type ShapeType =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'hexagon'
  | 'parallelogram'
  | 'star'
  | 'cloud'
  | 'heart'

export interface ShapeEntry {
  type: ShapeType
  label: string
  Icon: LucideIcon
}

export const SHAPES: ShapeEntry[] = [
  { type: 'rect', label: 'Rectangle', Icon: Square },
  { type: 'ellipse', label: 'Ellipse', Icon: Circle },
  { type: 'triangle', label: 'Triangle', Icon: Triangle },
  { type: 'diamond', label: 'Diamond', Icon: Diamond },
  { type: 'hexagon', label: 'Hexagon', Icon: Hexagon },
  { type: 'roundRect', label: 'Rounded rectangle', Icon: RectangleHorizontal },
  { type: 'parallelogram', label: 'Parallelogram', Icon: ParallelogramIcon },
  { type: 'star', label: 'Star', Icon: Star },
  { type: 'cylinder', label: 'Cylinder', Icon: Cylinder },
  { type: 'cloud', label: 'Cloud', Icon: Cloud },
  { type: 'heart', label: 'Heart', Icon: Heart },
]

/**
 * Shapes promoted to their own buttons in the compact horizontal toolbar — the
 * universal flowchart primitives (process, terminator, decision). The rest live
 * in the shapes popover.
 */
export const FEATURED_SHAPE_TYPES: ShapeType[] = ['rect', 'ellipse', 'diamond']

export const FEATURED_SHAPES: ShapeEntry[] = FEATURED_SHAPE_TYPES.map(
  (type) => SHAPES.find((shape) => shape.type === type)!,
)

export const MORE_SHAPES: ShapeEntry[] = SHAPES.filter(
  (shape) => !FEATURED_SHAPE_TYPES.includes(shape.type),
)
