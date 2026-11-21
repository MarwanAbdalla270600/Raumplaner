import { EntityId } from '../../../../core/domain/id';
import { furnitureOps, IndexedEntity, indexEntities, updateFloor, findFloor } from '../../domain/floor-operations';
import { FurnitureItem, Project } from '../../domain/model';
import { ProjectCommand } from './project-command';

export class AddFurnitureCommand implements ProjectCommand {
  readonly label = 'command.addFurniture';

  constructor(
    private readonly floorId: EntityId,
    private readonly items: readonly FurnitureItem[],
  ) {}

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => furnitureOps.add(floor, this.items));
  }

  revert(project: Project): Project {
    const ids = new Set(this.items.map((item) => item.id));
    return updateFloor(project, this.floorId, (floor) => furnitureOps.remove(floor, ids));
  }
}

export class RemoveFurnitureCommand implements ProjectCommand {
  readonly label = 'command.removeFurniture';
  private readonly removed: readonly IndexedEntity<FurnitureItem>[];

  /** Captures the removed items (and their positions in the list) from the current project. */
  constructor(
    project: Project,
    private readonly floorId: EntityId,
    private readonly ids: ReadonlySet<EntityId>,
  ) {
    this.removed = indexEntities(findFloor(project, floorId)?.furniture ?? [], ids);
  }

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => furnitureOps.remove(floor, this.ids));
  }

  revert(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => furnitureOps.insert(floor, this.removed));
  }
}

/** Generic "change properties" command used for move, rotate, scale, recolour, ... */
export class UpdateFurnitureCommand implements ProjectCommand {
  constructor(
    private readonly floorId: EntityId,
    private readonly before: readonly FurnitureItem[],
    private readonly after: readonly FurnitureItem[],
    readonly label = 'command.updateFurniture',
  ) {}

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => furnitureOps.replace(floor, this.after));
  }

  revert(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => furnitureOps.replace(floor, this.before));
  }
}
