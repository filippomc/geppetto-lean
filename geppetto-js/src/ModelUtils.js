import Resources from "./Resources";
import Variable from "./model/Variable";
import Type from "./model/Type";


export default class ModelUtils {


  /**
   * Build "list" of variables that have a visual type
   */
  static fetchVarsWithVisualTypes (node, varsWithVizTypes, parentPath) {
    /*
     * build "list" of variables that have a visual type (store "path")
     * check meta type - we are only interested in variables
     */
    var path = (parentPath === '') ? node.getId() : (parentPath + '.' + node.getId());
    if (node.getMetaType() === Resources.VARIABLE_NODE) {
      var allTypes = node.getTypes();
      for (var i = 0; i < allTypes.length; i++) {
        // if normal type or composite type check if it has a visual type
        if (allTypes[i].getMetaType() === Resources.TYPE_NODE || allTypes[i].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
          let vizType = allTypes[i].getVisualType();

          if (vizType !== undefined && vizType !== null) {
            // ADD to list of vars with viz types
            varsWithVizTypes.push(path);
          }
        } else if (allTypes[i].getMetaType() === Resources.ARRAY_TYPE_NODE) {
          // if array type, need to check what type the array is of
          let arrayType = allTypes[i].getType();
          let vizType = arrayType.getVisualType();

          if (vizType !== undefined && vizType !== null) {
            // ADD to list of vars with viz types
            varsWithVizTypes.push(path);
          }
        } else if ((allTypes[i].getMetaType() === Resources.VISUAL_TYPE_NODE) || (allTypes[i].getMetaType() === Resources.COMPOSITE_VISUAL_TYPE_NODE)) {
          varsWithVizTypes.push(path);
        }

        // RECURSE on any variables inside composite types
        if (allTypes[i].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
          let vars = allTypes[i].getVariables();

          if (vars !== undefined && vars !== null) {
            for (var j = 0; j < vars.length; j++) {
              ModelUtils.fetchVarsWithVisualTypes(vars[j], varsWithVizTypes, (parentPath === '') ? node.getId() : (parentPath + '.' + node.getId()));
            }
          }
        } else if (allTypes[i].getMetaType() === Resources.ARRAY_TYPE_NODE) {
          var arrayType = allTypes[i].getType();

          // check if the array is of composite type and if so recurse too on contained variables
          if (arrayType.getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
            let vars = arrayType.getVariables();

            if (vars !== undefined && vars !== null) {
              for (var j = 0; j < vars.length; j++) {
                ModelUtils.fetchVarsWithVisualTypes(vars[j], varsWithVizTypes, (parentPath === '') ? node.getId() : (parentPath + '.' + node.getId()));
              }
            }
          }
        }
      }
    }
  }

  /**
   * Get all POTENTIAL instances of a given type
   */
  static getAllPotentialInstancesOfType (typePath, paths) {
    return paths.filter(path => path.type === typePath).map(path => path.path);
  }

  /**
   * Get all POTENTIAL instances of a given meta type
   */
  static getAllPotentialInstancesOfMetaType (metaType, paths, includeType) {
    var matchingPotentialInstances = [];

    for (var i = 0; i < paths.length; i++) {
      if (paths[i].metaType === metaType) {
        var itemToPush = paths[i].path;
        if (includeType === true) {
          itemToPush = paths[i];
        }
        matchingPotentialInstances.push(itemToPush);
      }
    }

    return matchingPotentialInstances;
  }


  /**
   *
   * @param node
   * @param path
   * @returns {boolean}
   */
  static includePotentialInstance (node, path) {
    if (node.getType().getMetaType() === Resources.CONNECTION_TYPE) {
      return false;
    }

    if (node.getType().getMetaType() === Resources.TEXT_TYPE) {
      return false;
    }

    var nested = ModelUtils.getNestingLevel(path);
    if (node.getType().getMetaType() === Resources.COMPOSITE_TYPE_NODE && nested > 2) {
      return false;
    }

    return true;
  }

  /**
   * Get nesting level given entity path
   *
   * @param path
   * @returns {number}
   */
  static getNestingLevel (path) {
    return path.length - path.replace(/\./g, '').length;
  }

  /**
   * Build list of potential instance paths (excluding connection instances)
   */
  static fetchAllPotentialInstancePaths (node, allPotentialPaths, allPotentialPathsForIndexing, parentPath) {
    // build new path
    var xpath = '';
    var nodeRef = node;
    var isStaticVar = (nodeRef instanceof Variable) && node.isStatic();

    if (isStaticVar) {
      /*
       * NOTE: for static variables, we add the variable path to the indexing list as ...
       * NOTE: it's the only way to access the variable since there are no instances for static variables
       */
      xpath = node.getPath();
    } else {
      xpath = (parentPath === '') ? node.getId() : (parentPath + '.' + node.getId());
    }

    // build entry for path storing and indexing
    var entry = {
      path: xpath,
      metaType: node.getType().getMetaType(),
      type: node.getType().getPath(),
      static: isStaticVar
    };

    // always add if not a static var, otherwise check that it wasnt already added

    allPotentialPaths.push(entry);
    // only add to indexing if it's not a connection or nested in a composite type
    if (ModelUtils.includePotentialInstance(node, xpath)) {
      allPotentialPathsForIndexing.push(entry);
    }


    var potentialParentPaths = [];
    // check meta type - we are only interested in NON-static variables
    if ((nodeRef instanceof Variable) && !node.isStatic()) {
      var allTypes = node.getTypes();

      var arrayType = undefined;
      for (var m = 0; m < allTypes.length; m++) {
        if (allTypes[m].getMetaType() === Resources.ARRAY_TYPE_NODE) {
          arrayType = allTypes[m];
        }
      }

      // STEP 1: build list of potential parent paths
      if (arrayType !== undefined) {
        var arrayPath = arrayType.getType().getPath();
        var arrayMetaType = arrayType.getType().getMetaType();
        // add the [*] entry
        if (arrayType.getSize() > 1) {
          var starPath = xpath + '[' + '*' + ']';
          potentialParentPaths.push(starPath);

          var starEntry = {
            path: starPath,
            metaType: arrayMetaType,
            type: arrayPath
          };
          allPotentialPaths.push(starEntry);
          allPotentialPathsForIndexing.push(starEntry);
        }

        // add each array element path
        for (var n = 0; n < arrayType.getSize(); n++) {
          var arrayElementPath = xpath + '[' + n + ']';
          potentialParentPaths.push(arrayElementPath);

          var arrayElementEntry = {
            path: arrayElementPath,
            metaType: arrayMetaType,
            type: arrayPath
          };
          allPotentialPaths.push(arrayElementEntry);
          if (this.includePotentialInstance(node, arrayElementPath)) {
            allPotentialPathsForIndexing.push(arrayElementEntry);
          }
        }
      } else {
        potentialParentPaths.push(xpath);
      }

      // STEP 2: RECURSE on ALL potential parent paths
      var allTypes = node.getTypes();
      for (var i = 0; i < allTypes.length; i++) {
        // RECURSE on any variables inside composite types
        this.fetchAllPotentialInstancePathsForType(allTypes[i], allPotentialPaths, allPotentialPathsForIndexing, potentialParentPaths);
      }
    }
  }

  /**
   * Build list of partial instance types starting from a type
   */
  static fetchAllPotentialInstancePathsForType (type, allPotentialPaths, allPotentialPathsForIndexing, potentialParentPaths) {
    if (type.getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
      var vars = type.getVariables();

      if (vars !== undefined && vars !== null) {
        for (var j = 0; j < vars.length; j++) {
          if (potentialParentPaths.length > 0) {
            for (var g = 0; g < potentialParentPaths.length; g++) {
              this.fetchAllPotentialInstancePaths(vars[j], allPotentialPaths, allPotentialPathsForIndexing, potentialParentPaths[g]);
            }
          } else {
            // used for partial instance path generation
            this.fetchAllPotentialInstancePaths(vars[j], allPotentialPaths, allPotentialPathsForIndexing, '');
          }
        }
      }
    } else if (type.getMetaType() === Resources.ARRAY_TYPE_NODE) {
      var arrayType = type.getType();

      // check if the array is of composite type and if so recurse too on contained variables
      if (arrayType.getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
        var vars = arrayType.getVariables();

        if (vars !== undefined && vars !== null) {
          for (var l = 0; l < vars.length; l++) {
            if (potentialParentPaths.length > 0) {
              for (var h = 0; h < potentialParentPaths.length; h++) {
                this.fetchAllPotentialInstancePaths(vars[l], allPotentialPaths, allPotentialPathsForIndexing, potentialParentPaths[h]);
              }
            } else {
              // used for partial instance path generation
              this.fetchAllPotentialInstancePaths(vars[l], allPotentialPaths, allPotentialPathsForIndexing, '');
            }
          }
        }
      }
    }
  }


  /**
   * Find instance(s) given variable id, if any
   */
  static findMatchingInstanceByID (id, instances) {
    for (let i = 0; i < instances.length; i++) {
      if (instances[i].getId() === id) {
        return instances[i];
      } else {
        if (typeof this[i].getChildren === "function") {
          const recurseMatch = ModelUtils.findMatchingInstanceByID(id, instances[i].getChildren());
          if (recurseMatch !== null) {
            return recurseMatch;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find instance given instance path (unique), if any
   */
  static findMatchingInstance (instancePath, instances) {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].getRawInstancePath() === instancePath) {
        return instances[i];
      } else {
        if (typeof instances[i].getChildren === "function") {
          var recurseMatch = this.findMatchingInstance(instancePath, instances[i].getChildren());
          if (recurseMatch !== null) {
            return recurseMatch;
          }
        }
      }
    }

    return null;
  }

  /**
   * Find instance given Type
   */
  static findMatchingInstancesByType (type, instances) {
    for (var i = 0; i < instances.length; i++) {
      var types = instances[i].getTypes();
      for (var j = 0; j < types.length; j++) {
        if (types[j] === type || types[j].getVisualType() === type) {
          return instances[i];
        }
      }

      if (typeof instances[i].getChildren === "function") {
        return ModelUtils.findMatchingInstancesByType(type, instances[i].getChildren());
      }
    }
  }

  /**
   * Find instance given Variable
   */
  static findMatchingInstancesByVariable (variable, instances) {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].getVariable() === variable) {
        return instances[i];
      }

      if (typeof instances[i].getChildren === "function") {
        return ModelUtils.findMatchingInstancesByVariable(variable, instances[i].getChildren());
      }
    }
  }


  /**
   * Propagates a capability to parents of the given instance
   */
  static propagateCapabilityToParents (capability, instance) {
    var parent = instance.getParent();

    // check if it has capability
    if (!(parent === undefined || parent === null) && !parent.hasCapability(capability.capabilityId)) {
      // apply capability
      parent.extendApi(capability);
      // this.newObjectCreated(parent);

      ModelUtils.propagateCapabilityToParents(capability, parent);
    }

    // else --> live & let die
  }


  /**
   * Populate shortcuts of children onto parents
   */
  static populateChildrenShortcuts (node) {
    // check if getChildren exists, if so add shortcuts based on ids and recurse on each
    if (typeof node.getChildren === "function") {
      var children = node.getChildren();

      if (children !== undefined) {
        for (var i = 0; i < children.length; i++) {
          // do not populate shortcuts for array instances - children are accessed as array elements
          if (node instanceof Variable && children[i] instanceof Type) {
            // it's an anonymous type we don't want it to be in the path
            ModelUtils.populateChildrenShortcuts(children[i]);

            var grandChildren = children[i].getChildren();
            for (var j = 0; j < grandChildren.length; j++) {
              node[grandChildren[j].getId()] = grandChildren[j];
            }

            continue;
          }
          if (node.getMetaType() !== Resources.ARRAY_INSTANCE_NODE) {
            node[children[i].getId()] = children[i];
          }
          ModelUtils.populateChildrenShortcuts(children[i]);
        }
      }
    }
  }




  /**
   * Gets all variables with the given metaType
   *
   * @param typesToSearch
   *
   * @param metaType
   *
   * @returns {Array}
   */
  static getAllVariablesOfMetaType (typesToSearch, metaType) {
    // check if array and if not "make it so"
    if (!(typesToSearch.constructor === Array)) {
      typesToSearch = [typesToSearch];
    }

    var variables = [];

    for (var i = 0; i < typesToSearch.length; i++) {
      if (typesToSearch[i].getMetaType() === Resources.COMPOSITE_TYPE_NODE) {
        var nestedVariables = typesToSearch[i].getVariables();
        if (metaType !== undefined && metaType !== null) {
          for (var j = 0; j < nestedVariables.length; j++) {
            var varTypes = nestedVariables[j].getTypes();
            for (var x = 0; x < varTypes.length; x++) {
              if (varTypes[x].getMetaType() === metaType) {
                variables.push(nestedVariables[j]);
              }
            }
          }
        } else {
          variables = variables.concat(nestedVariables);
        }
      }
    }

    return variables;
  }
}
