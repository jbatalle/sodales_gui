'use strict';

angular.module('openNaaSApp')
        .controller('spController', function ($scope, $rootScope, MqNaaSResourceService, $filter, ngTableParams, spService, viNetService, localStorageService) {
            console.log("sp");
            $rootScope.networkId = localStorageService.get("networkId");
            $rootScope.spName = "SP1";
            $scope.data = [];
            $scope.updateSpList = function () {
                spService.list().then(function (data) {
                    console.log(data);
                });
                var urlListVI = "IRootResourceAdministration/" + $rootScope.networkId + "/IRequestManagement";
                MqNaaSResourceService.list(urlListVI).then(function (result) {
                    console.log(result);
//                    $scope.data = result.IResource.IResourceId;
                    $scope.tableParams.reload();
                });
                spService.getSPByName($rootScope.spName).then(function (result) {
                    console.log(result);
                    result.vi.forEach(function (vi) {
                        viNetService.getVIByName(vi).then(function (viInfo) {
                            console.log(viInfo);
                            $scope.data.push({name: viInfo.name, date: viInfo.date, status: "Created"});
                            $scope.tableParams.reload();
//                        $scope.data.push(viNetService.getVIByName(vi));
                        });
                    });
//                    $scope.data = result.vi;
                });
            };
            $scope.updateSpList();
            $scope.tableParams = new ngTableParams({
                page: 1, // show first page
                count: 10, // count per page
                sorting: {
                    date: 'desc'     // initial sorting
                }
            }, {
                total: $scope.data.length,
                getData: function ($defer, params) {
                    var data = checkIfIsArray($scope.data);
                    var orderedData = params.sorting() ? $filter('orderBy')(data, params.orderBy()) : data;
                    $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                }, $scope: {$data: {}}
            });

        })
        .controller('spVIController', function ($scope, $rootScope, MqNaaSResourceService, $routeParams, ngDialog, viNetService, localStorageService) {
            console.log("Edit VI : " + $routeParams.id);
            $scope.virtNetId = $routeParams.id;
            $scope.virtualPort = [];

            $scope.getNetworkResources = function () {
                console.log("NETWORK GET RESOURCE");
                var url = "IRootResourceAdministration/" + $rootScope.networkId + "/IRequestBasedNetworkManagement/" + $scope.virtNetId + "/IRootResourceProvider";
                MqNaaSResourceService.get(url).then(function (result) {
                    console.log(result);
                    var netEls = checkIfIsArray(result.IRootResource.IRootResourceId);
                    localStorageService.set("virtualElements", netEls);
                    $scope.networkRes = result.IRootResource.IRootResourceId;
                });
            };
            $scope.getNetworkResources();
            $scope.createOperation = function () {
                ngDialog.open({
                    template: 'partials/sodales/sp/arnOpDialog.html',
                    scope: $scope
                });
            }
            $scope.openOperationARNDialog = function (resourceName, type) {
                console.log("Dialog call");
                $scope.virtualResourceOp = resourceName;
                $scope.arn = new Object;
                ngDialog.open({
                    template: 'partials/sodales/sp/arnOpDialog.html',
                    scope: $scope
                });
            };

            $scope.openOperationCPEDialog = function (resourceName, type) {
                $scope.virtualResourceOp = resourceName;
                $scope.cpe = new Object;
                ngDialog.open({
                    template: 'partials/sodales/sp/cpeOpDialog.html',
                    scope: $scope
                });
            };

            $scope.getListVirtualResources = function () {
                viNetService.getVIByName($scope.viId).then(function (response) {
                    $scope.virtualResources = response.viRes;
                });
            };
            $scope.getListRealResources = function () {
                $scope.physicalResources = localStorageService.get("networkElements");
            };

            $scope.Configure = function (type, form) {
                console.log(type);
                if (type === "arn") {
                    console.log(form);
                    var arn = form;
                    var data = getARNVlanConnectivity(arn.upLinkIfaces1, arn.upLinkIfaces2, arn.downLinkIfaces1, arn.downLinkIfaces2, arn.upLinkVlan, arn.downLinkVlan);
                    var url = "IRootResourceAdministration/" + $rootScope.networkId + "/IRequestBasedNetworkManagement/" + $scope.virtNetId + "/IRootResourceProvider/" + $scope.virtualResourceOp + "/IVlanConnectivity/vlanConnectivity";
                    MqNaaSResourceService.put(url, data).then(function (result) {
                    });

                } else if (type === "cpe") {
                    console.log(form);
                    var cpe = form;
                    var data = getCPEVlanConnectivity(cpe.egressPortId, cpe.egressVlan, cpe.ingressPortId, cpe.ingressVlan, cpe.unitId);
                    var url = "IRootResourceAdministration/" + $rootScope.networkId + "/IRequestBasedNetworkManagement/" + $scope.virtNetId + "/IRootResourceProvider/" + $scope.virtualResourceOp + "/IVlanConnectivity/vlanConnectivity";
                    MqNaaSResourceService.put(url, data).then(function (result) {});
                }
                $rootScope.info = "200 - Operation done";
                ngDialog.close();
            };
        })
        .controller('spStatsController', function ($scope, ngTableParams, $filter, $routeParams, localStorageService, ngDialog, arnService, cpeService, $interval, viNetService) {
            var promise;
            var availableResources = [];
            $scope.selected = "";
            $scope.vi = $routeParams.id;
            $scope.vi = "vi-1";
            viNetService.getVIByName($scope.vi).then(function (result) {
                console.log(result);
                console.log(result.viRes);
                $scope.availableResources;
            });

            localStorageService.get("networkElements").forEach(function (el) {
                console.log(el);
                if (el !== null)
                    availableResources.push({name: el, type: el.split("-")[0]});
            });
            $scope.availableResources = availableResources;

            $scope.dropdown = [{"text": "CFM/OAM", "click": "selectedResource('', 'CFM/OAM')"}];
            $scope.selectedResource = function (resourceName, resourceType) {
                //get statistics and send to scope
                console.log("Selected " + resourceName);
                if (resourceType === 'CPE') {
                    $scope.selected = resourceName;
                    $scope.noResource = false;
                    $scope.CPEactive = "active";
                    $scope.ARNactive = "";
                    $scope.ARNStats = false;
                    $scope.CPEStats = true;
                    $scope.CFM_OAM = false;
                    $scope.getCPEPortList();
                }
                else if (resourceType === 'CFM/OAM') {
                    $scope.selected = resourceName;
                    $scope.noResource = false;
                    $scope.CPEactive = "active";
                    $scope.ARNactive = "";
                    $scope.ARNStats = false;
                    $scope.CPEStats = false;
                    $scope.CFM_OAM = true;
                    $scope.getCCM();
                    $scope.getLBM();
                    $scope.getDMM();
                } else if (resourceType === 'ARN') {
                    $scope.selected = resourceName;
                    $scope.noResource = false;
                    $scope.ARNactive = "active";
                    $scope.CPEactive = "";
                    $scope.ARNStats = true;
                    $scope.CPEStats = false;
                    $scope.CFM_OAM = false;
                    console.log("GET ARN");
                    $scope.getARNStats();
                }
            };
            $scope.getARNStats = function () {
                console.log("REQUEST ARN Stats");
                //            var data = getLAGs();
                var data = getLinkStatus();
                arnService.put(data).then(function (response) {
                    var oldData = response.response.operation.interfaceList.interface;
//                data = [{_name: "Eth 1"}, {_name: "Eth 2"}, {_name: "Eth 4"}];
                console.log(data);
                
                var data = [];
                oldData.forEach(function(entry){
                    if(entry._name == "Eth 1" || entry._name == "intEth 1") data.push(entry);
                })
                $scope.element = $routeParams.id;
//                $scope.data = data.response.operation.interfaceList.interface;
//                localStorageService.set("mqNaaSElements", data);
//                console.log($scope.data);
                $scope.tableParams = new ngTableParams({
                    page: 1, // show first page
                    count: 10, // count per page
                    sorting: {
                        date: 'desc'     // initial sorting
                    }
                }, {
                    total: data.length,
                    getData: function ($defer, params) {
                        console.log(data);

                        var orderedData = params.sorting() ? $filter('orderBy')(data, params.orderBy()) : data;
                        $defer.resolve(orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count()));
                    },
                    $scope: {$data: {}}
                });
                });
            };
            $scope.getCPEPortList = function () {
                var reqListPortsUrl = "meaPortMapping.xml?unit=0";
                cpeService.get(reqListPortsUrl).then(function (response) {
                    $scope.cpePortList = response.meaPortMapping.portMapping;
                });
            };
            $scope.getCPEStats = function (portId) {
                var reqUrl = "meaPmCounter.xml?unit=0&pmId=" + portId;
                $interval.cancel(promise);
                promise = $interval(function () {

                    cpeService.get(reqUrl).then(function (response) {
                        $scope.content = response.meaPmCounter.PmCounter;
                        console.log($scope.content);
                    });
                }, 1000);
            };

            $scope.$on("$destroy", function () {
                if (promise) {
                    $interval.cancel(promise);
                }
            });

            $scope.getCCM = function (portId) {
                var reqUrl = "meaGetCcmDefectState.xml?unit=0&streamId=1";
                var xml = '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/css" href=="olg_rss.css" ?><meaCcmCounter xmlns="http://www.ethernity-net.com/enet/CcmCounter"><CcmDefectCount><unit>0</unit><LastSequenc>1832557</LastSequenc><Unexpected_MEG_ID>0</Unexpected_MEG_ID><Unexpected_MEP_ID>0</Unexpected_MEP_ID><reorder>4</reorder><eventLoss>0</eventLoss></CcmDefectCount></meaCcmCounter>';
                var x2js = new X2JS();
                var json = x2js.xml_str2json(xml);
//                $scope.ccmCounter = json.meaCcmCounter.CcmDefectCount;
                var data = json.meaCcmCounter.CcmDefectCount;
                console.log(data);
                cpeService.get(reqUrl).then(function (response) {
                    console.log(response);
                    $scope.ccmCounter = response.meaCcmCounter.CcmDefectCount;
                });
            };
            $scope.getLBM = function (portId) {
                var reqUrl = "meaGetLbmStatistics.xml?unit=0&stream_id=1";
                var xml = '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/css" href=="olg_rss.css" ?><meaStatistics xmlns="http://www.ethernity-net.com/enet/LbmDmmStatistics"><lbmDmmStatistics><unit>0</unit><AVG_latency>0</AVG_latency><Bytes>1735000</Bytes><MAX_jitter>0</MAX_jitter><MIN_jitter>4294967295</MIN_jitter><Pkts>1735</Pkts><drop>0</drop><lastseqID>1754</lastseqID><num_Of_Bits_Error>6695669</num_Of_Bits_Error><seq_ID_err>0</seq_ID_err><seq_ID_reorder>0</seq_ID_reorder></lbmDmmStatistics></meaStatistics>';
                var x2js = new X2JS();
                var json = x2js.xml_str2json(xml);
//                $scope.lbmCounter = json.meaStatistics.lbmDmmStatistics;
                console.log(json.meaStatistics.lbmDmmStatistics);
                cpeService.get(reqUrl).then(function (response) {
                    console.log(response);
                    $scope.lbmCounter = response.meaStatistics.lbmDmmStatistics;
                });
            };
            $scope.getDMM = function (portId) {
                var reqUrl = "meaGetDmmStatistics.xml?unit=0&stream_id=1";
                var xml = '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/css" href=="olg_rss.css" ?><meaStatistics xmlns="http://www.ethernity-net.com/enet/LbmDmmStatistics"><lbmDmmStatistics><unit>0</unit><AVG_latency>5408</AVG_latency><Bytes>0</Bytes><MAX_jitter>6240</MAX_jitter><MIN_jitter>5312</MIN_jitter><Pkts>0</Pkts><drop>0</drop><lastseqID>0</lastseqID><num_Of_Bits_Error>0</num_Of_Bits_Error><seq_ID_err>0</seq_ID_err><seq_ID_reorder>0</seq_ID_reorder></lbmDmmStatistics></meaStatistics>';
                var x2js = new X2JS();
                var json = x2js.xml_str2json(xml);
//                $scope.dmmCounter = json.meaStatistics.lbmDmmStatistics;
                console.log(json.meaStatistics.lbmDmmStatistics);
                cpeService.get(reqUrl).then(function (response) {
                    console.log(response);
                    var data = response.meaStatistics.lbmDmmStatistics;
                    $scope.dmmCounter = response.meaStatistics.lbmDmmStatistics;
                });

            };

            $scope.configureCCM = function () {
                var url = "ccmSetting.html?unit=0&stream_id=1&activate=1&destMac=00:01:03:05:06:09&vlanId=10&srcPort=104&megLevel=4&cfmVersion=0&ccmPeriod=1&rdiEnable=1&megId=ccmTest&lmEnable=1&remoteMepId=10&localMepId=9&policerId=3&outServiceId=6&inServiceId=7&Priority=7";
                cpeService.get(url).then(function (response) {
                });
                url = "meaGetCcmConfig.xml?unit=0&stream_id=1";
                cpeService.get(url).then(function (response) {
                });
            };

            $scope.configureLBM = function () {
                var url = "lbSetting.html?unit=0&stream_id=1&activate=1&destMac=00:01:03:05:06:09&vlanId=11&srcPort=104&megLevel=4&cfmVersion=0&policerId=3&Priority=4&lbmSide=1";
                cpeService.get(url).then(function (response) {
                });
                url = "meaGetLbConfig.xml?unit=0&stream_id=1";
                cpeService.get(url).then(function (response) {
                });
            };

            $scope.configureDMM = function () {
                var url = "dmSetting.html?unit=0&stream_id=1&activate=1&destMac=00:01:03:05:06:09&vlanId=12&srcPort=104&megLevel=4&cfmVersion=0&policerId=3&Priority=4&dmmSide=1";
                cpeService.get(url).then(function (response) {
                });
                url = "meaGetDmConfig.xml?unit=0&stream_id=1";
                cpeService.get(url).then(function (response) {
                });
            };

            $scope.viewStatistics = function (interfaceId) {
                $scope.infId = interfaceId;
                ngDialog.open({
                    template: 'partials/sodales/counterStats.html',
                    controller: 'statisticsCtrl',
                    scope: $scope}
                );
            };
            $scope.navClass = function (page) {

                return page === $scope.selected ? 'active' : '';
            };
            $scope.getClass = function (ind) {
                console.log("GET CLASS");
                if (ind === "ARN") {
                    return "ARNactive";
                } else {
                    return "CPEactive";
                }
            }

//            $scope.selectedResource("ARN");
            if (availableResources.length > 0)
                $scope.selectedResource(availableResources[0].type);
            $scope.noResource = true;
        })