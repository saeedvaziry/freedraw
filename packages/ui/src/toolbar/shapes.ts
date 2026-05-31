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
