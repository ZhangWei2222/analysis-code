/* @flow */

import Regexp from "path-to-regexp";
import { cleanPath } from "./util/path";
import { assert, warn } from "./util/warn";

export function createRouteMap(
  routes: Array<RouteConfig>,
  oldPathList?: Array<string>,
  oldPathMap?: Dictionary<RouteRecord>,
  oldNameMap?: Dictionary<RouteRecord>
): {
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>
} {
  // 创建映射表
  const pathList: Array<string> = oldPathList || [];
  // path 路由 map
  const pathMap: Dictionary<RouteRecord> = oldPathMap || Object.create(null);
  // name 路由 map
  const nameMap: Dictionary<RouteRecord> = oldNameMap || Object.create(null);

  // 遍历路由配置，为每个配置添加路由记录
  routes.forEach(route => {
    addRouteRecord(pathList, pathMap, nameMap, route);
  });

  // 确保通配符在最后
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === "*") {
      pathList.push(pathList.splice(i, 1)[0]);
      l--;
      i--;
    }
  }

  if (process.env.NODE_ENV === "development") {
    // warn if routes do not include leading slashes
    const found = pathList
      // check for missing leading slash
      .filter(path => path && path.charAt(0) !== "*" && path.charAt(0) !== "/");

    if (found.length > 0) {
      const pathNames = found.map(path => `- ${path}`).join("\n");
      warn(
        false,
        `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`
      );
    }
  }

  return {
    pathList,
    pathMap,
    nameMap
  };
}

// 添加路由记录
function addRouteRecord(
  pathList: Array<string>,
  pathMap: Dictionary<RouteRecord>,
  nameMap: Dictionary<RouteRecord>,
  route: RouteConfig,
  parent?: RouteRecord,
  matchAs?: string
) {
  // 获得路由配置下的属性
  const { path, name } = route;
  if (process.env.NODE_ENV !== "production") {
    assert(path != null, `"path" is required in a route configuration.`);
    assert(
      typeof route.component !== "string",
      `route config "component" for path: ${String(
        path || name
      )} cannot be a ` + `string id. Use an actual component instead.`
    );
  }

  // 编译正则的选项
  const pathToRegexpOptions: PathToRegexpOptions =
    route.pathToRegexpOptions || {};
  normalizePath;
  // 格式化 url，会删除末尾的/，如果route是子级，会连接父级和子级的path，形成一个完整的path
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  );

  // 匹配规则是否大小写敏感？(默认值：false)
  if (typeof route.caseSensitive === "boolean") {
    pathToRegexpOptions.sensitive = route.caseSensitive;
  }

  // 生成记录对象
  const record: RouteRecord = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    instances: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
        ? route.props
        : { default: route.props }
  };

  if (route.children) {
    // 递归路由配置的 children 属性，添加路由记录
    if (process.env.NODE_ENV !== "production") {
      if (
        route.name &&
        !route.redirect &&
        route.children.some(child => /^\/?$/.test(child.path))
      ) {
        warn(
          false,
          `Named Route '${route.name}' has a default child route. ` +
            `When navigating to this named route (:to="{name: '${route.name}'"), ` +
            `the default child route will not be rendered. Remove the name from ` +
            `this route and use the name of the default child route for named ` +
            `links instead.`
        );
      }
    }
    route.children.forEach(child => {
      // matchAs 路由别名
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined;
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
    });
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path);
    pathMap[record.path] = record;
  }

  // 如果路由有别名的话
  // 给别名也添加路由记录
  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias];
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i];
      if (process.env.NODE_ENV !== "production" && alias === path) {
        warn(
          false,
          `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
        );
        // skip in dev to make it work
        continue;
      }

      const aliasRoute = {
        path: alias,
        children: route.children
      };
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || "/" // matchAs
      );
    }
  }

  // 命名路由添加记录
  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record;
    } else if (process.env.NODE_ENV !== "production" && !matchAs) {
      warn(
        false,
        `Duplicate named routes definition: ` +
          `{ name: "${name}", path: "${record.path}" }`
      );
    }
  }
}

function compileRouteRegex(
  path: string,
  pathToRegexpOptions: PathToRegexpOptions
): RouteRegExp {
  const regex = Regexp(path, [], pathToRegexpOptions);
  if (process.env.NODE_ENV !== "production") {
    const keys: any = Object.create(null);
    regex.keys.forEach(key => {
      warn(
        !keys[key.name],
        `Duplicate param keys in route with path: "${path}"`
      );
      keys[key.name] = true;
    });
  }
  return regex;
}

function normalizePath(
  path: string,
  parent?: RouteRecord,
  strict?: boolean
): string {
  if (!strict) path = path.replace(/\/$/, "");
  if (path[0] === "/") return path;
  if (parent == null) return path;
  return cleanPath(`${parent.path}/${path}`);
}
