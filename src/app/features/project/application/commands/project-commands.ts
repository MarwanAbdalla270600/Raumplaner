import { EntityId } from '../../../../core/domain/id';
import { CustomFurnitureDefinition, Floor, Project } from '../../domain/model';
import { insertAtIndices } from '../../domain/floor-operations';
import { ProjectCommand } from './project-command';

export class AddFloorCommand implements ProjectCommand {
  readonly label = 'command.addFloor';

  constructor(private readonly floor: Floor) {}

  apply(project: Project): Project {
    return { ...project, floors: [...project.floors, this.floor] };
  }

  revert(project: Project): Project {
    return { ...project, floors: project.floors.filter((floor) => floor.id !== this.floor.id) };
  }
}

export class RemoveFloorCommand implements ProjectCommand {
  readonly label = 'command.removeFloor';
  private readonly index: number;
  private readonly floor: Floor | undefined;

  constructor(project: Project, floorId: EntityId) {
    this.index = project.floors.findIndex((floor) => floor.id === floorId);
    this.floor = project.floors[this.index];
  }

  apply(project: Project): Project {
    const floor = this.floor;
    return floor ? { ...project, floors: project.floors.filter((entry) => entry.id !== floor.id) } : project;
  }

  revert(project: Project): Project {
    return this.floor
      ? { ...project, floors: insertAtIndices(project.floors, [{ index: this.index, entity: this.floor }]) }
      : project;
  }
}

export class RenameFloorCommand implements ProjectCommand {
  readonly label = 'command.renameFloor';

  constructor(
    private readonly floorId: EntityId,
    private readonly before: string,
    private readonly after: string,
  ) {}

  apply(project: Project): Project {
    return this.rename(project, this.after);
  }

  revert(project: Project): Project {
    return this.rename(project, this.before);
  }

  private rename(project: Project, name: string): Project {
    return {
      ...project,
      floors: project.floors.map((floor) => (floor.id === this.floorId ? { ...floor, name } : floor)),
    };
  }
}

export class AddCustomFurnitureCommand implements ProjectCommand {
  readonly label = 'command.addCustomFurniture';

  constructor(private readonly definition: CustomFurnitureDefinition) {}

  apply(project: Project): Project {
    return { ...project, customCatalog: [...project.customCatalog, this.definition] };
  }

  revert(project: Project): Project {
    return {
      ...project,
      customCatalog: project.customCatalog.filter((entry) => entry.id !== this.definition.id),
    };
  }
}
