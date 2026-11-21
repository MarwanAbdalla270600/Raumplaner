import { EntityId } from '../../../../core/domain/id';
import { findFloor, IndexedEntity, indexEntities, roomOps, updateFloor } from '../../domain/floor-operations';
import { Project, Room } from '../../domain/model';
import { ProjectCommand } from './project-command';

export class AddRoomCommand implements ProjectCommand {
  readonly label = 'command.addRoom';

  constructor(
    private readonly floorId: EntityId,
    private readonly room: Room,
  ) {}

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.add(floor, [this.room]));
  }

  revert(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.remove(floor, new Set([this.room.id])));
  }
}

export class RemoveRoomCommand implements ProjectCommand {
  readonly label = 'command.removeRoom';
  private readonly removed: readonly IndexedEntity<Room>[];

  constructor(
    project: Project,
    private readonly floorId: EntityId,
    private readonly roomId: EntityId,
  ) {
    this.removed = indexEntities(findFloor(project, floorId)?.rooms ?? [], new Set([roomId]));
  }

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.remove(floor, new Set([this.roomId])));
  }

  revert(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.insert(floor, this.removed));
  }
}

export class UpdateRoomCommand implements ProjectCommand {
  constructor(
    private readonly floorId: EntityId,
    private readonly before: Room,
    private readonly after: Room,
    readonly label = 'command.updateRoom',
  ) {}

  apply(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.replace(floor, [this.after]));
  }

  revert(project: Project): Project {
    return updateFloor(project, this.floorId, (floor) => roomOps.replace(floor, [this.before]));
  }
}
