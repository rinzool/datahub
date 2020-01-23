import EmberObject, { set, get } from '@ember/object';
import { computed } from '@ember/object';
import { groupBy } from '@datahub/utils/array/group-by';
import { setProperties } from '@ember/object';
import { keyBy } from 'lodash';

/**
 * INode interface. It represents a node in a graph, you can
 * specify the type of the payload (default is undefined) for that node
 */
export interface INode<T> {
  // unique id for a node
  id: number;
  // level of the tree that this node belongs
  level: number;
  // if node is selected or not
  selected?: boolean;
  // if node has loaded its data
  loaded?: boolean;
  // Custom data for the node
  payload?: T;
}

/**
 * IEdge interface. Represents the relation between to nodes, also,
 * it has direction, that is why it has from and to.
 */
export interface IEdge<T> {
  // edge starting node
  from: INode<T>['id'];
  // edge finish node
  to: INode<T>['id'];
}

/**
 * GraphDb helps us to create and query a graph with one peculiarity, it is divided into
 * two section (which suits the dataset lineage usecase): Upstream and Downstream, which
 * is represented as level -1 (upstream) or 1 (downstream). A downstream subtree will be
 * generated by adding children to nodes. A upstream subtree will be constructed add parents
 * to nodes.
 *
 * Also note that this graph is made to represent treelike structures with ability of a node to have
 * multiple parents but still having levels
 */
export default class GraphDb<T> extends EmberObject {
  // list of nodes in the graph
  nodes: Array<INode<T>> = [];
  // edges in the graph
  edges: Array<IEdge<T>> = [];
  // unique keys that helps to identity a node when only its payload is provided
  uniqueKeys: Array<string> = [];
  // internal id generator
  idGenerator: number = 1;

  /**
   * Index to access edges by from
   */
  @computed('edges')
  get edgesByFrom(): Record<string, Array<IEdge<T>>> {
    return groupBy(this.edges, 'from');
  }

  /**
   * Index to access edges by to
   */
  @computed('edges')
  get edgesByTo(): Record<string, Array<IEdge<T>>> {
    return groupBy(this.edges, 'to');
  }

  /**
   * Index to access nodes by id
   */
  @computed('nodes')
  get nodesById(): Record<string, INode<T>> {
    return keyBy(this.nodes, 'id');
  }

  /**
   * Index to access the parents of a node
   */
  @computed('nodes')
  get parentsByNodeId(): Record<string, Array<INode<T>>> {
    return this.nodes.reduce((parentIdsByNodeId, node): Record<string, Array<INode<T>>> => {
      const parentIds: Array<INode<T>> = (this.edgesByFrom[node.id] || []).map(
        (edge): INode<T> => this.nodesById[edge.to]
      );
      return { ...parentIdsByNodeId, [node.id]: parentIds };
    }, {});
  }

  /**
   * Index to access the children of a node
   */
  @computed('nodes')
  get childrenByNodeId(): Record<string, Array<INode<T>>> {
    return this.nodes.reduce((childIdsByNodeId, node): Record<string, Array<INode<T>>> => {
      const childIds: Array<INode<T>> = (this.edgesByTo[node.id] || []).map(
        (edge): INode<T> => this.nodesById[edge.from]
      );
      return { ...childIdsByNodeId, [node.id]: childIds };
    }, {});
  }

  /**
   * Filter downstream nodes only
   */
  @computed('nodes')
  get downstreamNodes(): Array<INode<T>> {
    return this.nodes.filter((node): boolean => node.level > 0);
  }

  /**
   * Filter upstream nodes only
   */
  @computed('nodes')
  get upstreamNodes(): Array<INode<T>> {
    return this.nodes.filter((node): boolean => node.level < 0);
  }

  /**
   * Creates dynamically indexes for the payload to quickly identify nodes
   * when only payload is provided
   */
  @computed('nodes', 'uniqueKeys')
  get uniqueIndexes(): Record<string, Record<string, INode<T>>> {
    return this.uniqueKeys.reduce((indexes, propertyName): Record<string, Record<string, INode<T>>> => {
      return {
        ...indexes,
        [propertyName]: keyBy(
          this.nodes,
          (node): INode<T>[keyof INode<T>] => get(node, `payload.${propertyName}` as keyof INode<T>) as number
        )
      };
    }, {});
  }

  /**
   * Returns the min level of the graph
   */
  @computed('nodes')
  get minLevel(): number {
    return this.nodes.reduce((min, node): number => (node.level < min ? node.level : min), 0);
  }

  /**
   * Using the payload and the uniqueKeys index (which needs to be specified), it will find
   * the node that contains that payload
   * @param nodePayload the payload of a node
   */
  findNode(nodePayload: T): INode<T> | undefined {
    const node = this.uniqueKeys.reduce((object: INode<T> | undefined, uniqueKey): INode<T> => {
      if (object) {
        return object;
      }

      const index = this.uniqueIndexes[uniqueKey];
      const propertyValue = `${get(nodePayload, uniqueKey as keyof T)}`;

      return index[propertyValue];
    }, undefined);
    return node;
  }

  /**
   * Return is a node is a downstream node or upstream
   * @param node
   */
  getIsUpstream(node: INode<T>): boolean {
    return node.level < 0;
  }

  /**
   * Get all ancestor or descendants in a flat array
   * @param node
   * @param up
   * @param stopAtLevel you can stop at a certain level by the default the boundary of upstream/downstream
   */
  getHierarchyNodes(node: INode<T>, up: boolean = true, stopAtLevel: number = 0): Array<INode<T>> {
    let exploredNodes: Array<INode<T>> = [node];
    let currentNodes: Array<INode<T>> = [node];
    while (currentNodes.length !== 0) {
      currentNodes = currentNodes.reduce((newNodes, node): Array<INode<T>> => {
        if (node.level !== stopAtLevel) {
          const graphDbQuery = up ? this.parentsByNodeId : this.childrenByNodeId;
          return [...newNodes, ...graphDbQuery[node.id]];
        }
        return newNodes;
      }, []);
      exploredNodes = [...exploredNodes, ...currentNodes];
    }
    return exploredNodes;
  }

  /**
   * Add a node to the graph.
   * For the first node in the graph, parentNode or upstream is not required.
   * After the first one, parentNode is required.
   * @param node
   * @param parentNode
   * @param upstream will increase or decrease the parent's node level this the new node.
   */
  addNode(node: T, parentNode?: INode<T>, upstream?: boolean): INode<T> {
    let newNode = this.findNode(node);

    if (!newNode) {
      const level = parentNode ? (upstream ? parentNode.level - 1 : parentNode.level + 1) : 0;

      newNode = {
        id: this.idGenerator,
        level: level,
        payload: node
      };

      setProperties(this, {
        nodes: [...this.nodes, newNode],
        idGenerator: this.idGenerator + 1
      });
    }

    if (parentNode) {
      const edgeParent = upstream ? parentNode : newNode;
      const edgeChild = upstream ? newNode : parentNode;
      this.addEdge(edgeChild, edgeParent);
    }

    return newNode;
  }

  /**
   * Will add a edge to the graph making sure there is not already one
   * @param parent
   * @param child
   */
  addEdge(parent: INode<T>, child: INode<T>): void {
    const edge = {
      from: child.id,
      to: parent.id
    };
    const fromIndex = this.edgesByFrom[edge.from] || [];
    const alreadyExists = fromIndex.find((otherEdge): boolean => otherEdge.to === edge.to);

    if (!alreadyExists) {
      set(this, 'edges', [...this.edges, edge]);
    }
  }

  /**
   * Change node attributes in a Redux style (not mutating the object)
   * @param id
   * @param attrs
   */
  setNodeAttrs(id: number, attrs: Partial<INode<T>>): void {
    set(
      this,
      'nodes',
      this.nodes.map(
        (node): INode<T> => {
          if (node.id === id) {
            return {
              ...node,
              ...attrs
            };
          }
          return node;
        }
      )
    );
  }

  /**
   * Will toggle the node.
   * If the node is unselected, will unselect all children.
   * If the node is selected, will select the current ancestors path, and unselect all other nodes
   * @param id
   */
  toggle(id: number): void {
    const node = this.nodesById[id];
    const { selected } = this.nodesById[id];
    const upstream = this.getIsUpstream(node);
    let toUnselect: Array<INode<T>> = [];
    let toSelect: Array<INode<T>> = [];

    if (selected) {
      if (node.level === 0) {
        // unselect all
        toUnselect = this.nodes;
      } else {
        // unselect descendants from this node
        toUnselect = this.getHierarchyNodes(node, upstream);
      }
    } else {
      // select operation: Will unselect everything and select the right nodes
      if (upstream) {
        toUnselect = this.upstreamNodes;
      } else {
        toUnselect = this.downstreamNodes;
      }

      // Then select the right node chain
      toSelect = this.getHierarchyNodes(node, !upstream);
    }

    toUnselect.forEach((node): void => {
      this.setNodeAttrs(node.id, {
        selected: false
      });
    });
    toSelect.forEach((node): void => {
      this.setNodeAttrs(node.id, {
        selected: true
      });
    });

    this.setNodeAttrs(node.id, {
      selected: !selected
    });
  }
}
