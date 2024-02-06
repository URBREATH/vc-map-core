import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import { EventType } from '../../../interaction/interactionType.js';
import { vertexSymbol } from '../editorSymbols.js';
import VcsEvent from '../../../vcsEvent.js';
import { Vertex } from '../editorHelpers.js';
import { emptyStyle } from '../../../style/styleHelpers.js';

/**
 * Class to translate a vertex. Will call the passed in vertex changed event with the changed vertex.
 * Will modify the vertex in place
 */
class TranslateVertexInteraction extends AbstractInteraction {
  readonly vertexChanged = new VcsEvent<Vertex>();

  private _vertex: Vertex | null = null;

  constructor() {
    super(EventType.DRAGEVENTS);
    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (this._vertex) {
      this._vertex.getGeometry()!.setCoordinates(event.positionOrPixel);
      this.vertexChanged.raiseEvent(this._vertex);

      if (event.type & EventType.DRAGEND) {
        this._vertex.unset('olcs_allowPicking');
        this._vertex.setStyle(undefined);
        this._vertex = null;
      }
      event.stopPropagation = true;
    } else if (
      event.type & EventType.DRAGSTART &&
      event.feature &&
      (event.feature as Vertex)[vertexSymbol]
    ) {
      this._vertex = event.feature as Vertex;
      this._vertex.set('olcs_allowPicking', false);
      this._vertex.setStyle(emptyStyle);
      event.stopPropagation = true;
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this.vertexChanged.destroy();
    super.destroy();
  }
}

export default TranslateVertexInteraction;
