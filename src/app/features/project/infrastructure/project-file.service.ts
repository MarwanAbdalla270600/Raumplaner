import { Injectable } from '@angular/core';
import { parseProjectDocument, ParseResult, toProjectDocument } from '../domain/project-document';
import { Project } from '../domain/model';

const JSON_INDENT = 2;
const FILE_NAME_PATTERN = /[^a-z0-9äöüß_-]+/gi;

/** Browser file I/O for JSON export and import. */
@Injectable({ providedIn: 'root' })
export class ProjectFileService {
  exportToFile(project: Project): void {
    const json = JSON.stringify(toProjectDocument(project), null, JSON_INDENT);
    const blob = new Blob([json], { type: 'application/json' });
    this.download(blob, `${this.fileName(project.name)}.raumplaner.json`);
  }

  async importFromFile(file: File): Promise<ParseResult> {
    return parseProjectDocument(await file.text());
  }

  download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private fileName(name: string): string {
    return name.trim().replace(FILE_NAME_PATTERN, '-').toLowerCase() || 'projekt';
  }
}
