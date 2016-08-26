/**
 * ios server
 *
 * */

"use strict";
let os = require('os');
let fs = require('fs');
let cp = require('child_process');
let path = require("path");

let router = require("koa-router")();
let md5 = require("md5");
let log4js = require('log4js');
let del = require('del');
let _ = require('lodash');

let logger = log4js.getLogger('app');

// 路由配置文件所在目录
const ROOT_PATH = process.cwd() + '/controller';

module.exports = function(app, config) {
    wakler(ROOT_PATH).forEach((route) => {
        logger.info(route.path)
        router.register(route.path, route.method, route.middleware);
    });

    app.use(router.routes())
        .use(router.allowedMethods());
};

/**
 * 遍历路由文件
 * @param  {[type]} root 启动路由分析的路径
 * @return {[type]}      [description]
 */
function wakler(root){
    let res = [],
    files = fs.readdirSync(root);

    files.forEach((file) => {
        let filePath = root + '/' + file,
        stat = fs.lstatSync(filePath);
        if (!stat.isDirectory()) {
            let routerConfig = require(filePath);
            let routerList = routerConfig.routers;
            // 如果路由中配置了BASE PATH，则使用配置的，否则使用文件所在的文件夹（相对于root的）作为BASE PATH
            let BASE_PATH = routerConfig.BASE_PATH ? routerConfig.BASE_PATH : processPath( filePath );
            routerList.forEach( router => res = res.concat( processRouter( router, file, BASE_PATH, routerConfig ) ));

        } else {
            res = res.concat(wakler(filePath));
        }
    });
    return res;
}

/**
 * 处理自定义的路由规则
 * 1. path未定义或是为“”的话，使用文件相对于root目录的路径为路由url（包括文件名，但不包括文件后缀）
 * 2. path为字符串的话，使用基路径+path的值作为路由url
 * 3. path为数据的话，数组元素的值参照2中的规则，数组中的所有url都使用同一个middleware处理业务逻辑
 * 4. method默认值为GET请求，支持多请求方法定义
 * 5. middleware为请求的处理逻辑
 * @param  {[type]} router   单个路由的配置
 * @param  {[type]} filePath 路由自定义文件在文件系统中的完整路径
 * @param  {[type]} basePath url的根地址
 * @return {[type]}          [description]
 */
function processRouter(router, file, basePath, routerConfig){
    let paths = [];
    let res = [];
    let reg = /\/{2,}/g;
    if(router.path && _.isString(router.path)){
        paths.push( (basePath + "/" + router.path).replace(reg, "/") );
    }else if(router.path && _.isArray(router.path)){
        paths = router.path.map( item => (basePath + "/" + item).replace(reg, "/") );
    }else{
        paths.push((basePath + "/" + file).replace(reg, "/").split('.')[0]);
    }

    // 进路由和出路由时添加钩子函数, 全局钩子函数先执行，再执行路由自己的钩子函数
    let controller = function *(){
        if(routerConfig.preProcessor) yield routerConfig.preProcessor.bind(this)();
        if(router.preProcessor) yield router.preProcessor.bind(this)();
        if(router.middleware) yield router.middleware.bind(this)();
        if(routerConfig.postProcessor)  yield routerConfig.postProcessor.bind(this)();
        if(router.postProcessor)  yield router.postProcessor.bind(this)();
    }

    // 得到文件内容
    paths.forEach((path)=>{
        res.push({
            path: path,
            method: router.method || ['GET'],
            middleware: controller
        });
    });

    return res;
}

/**
 * 获取文件所在的文件夹的地址，用于路由的根路径
 * @param  {[type]} filePath 路由配置文件路径
 * @return {[type]}          [description]
 */
function processPath(filePath){
    const relateFilePath = filePath.replace(ROOT_PATH, '');
    const index = relateFilePath.lastIndexOf("/");
    return index === 0 ? "/" : relateFilePath.slice(0, index);
}
