function TravisCtrl($http, $scope, $timeout, $log) {
    var repositories = [
        ['cloudify-cosmo/cloudify-manager', 'circle'],
        ['cloudify-cosmo/cloudify-cli', 'circle'],
        ['cloudify-cosmo/cloudify-dsl-parser', 'circle'],
        ['cloudify-cosmo/cloudify-rest-client', 'circle'],
        ['cloudify-cosmo/cloudify-diamond-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-docker-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-cloudstack-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-script-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-chef-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-puppet-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-openstack-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-plugins-common', 'circle'],
        ['cloudify-cosmo/cloudify-fabric-plugin', 'circle'],
        ['cloudify-cosmo/cloudify-amqp-influxdb', 'circle'],
        ['cloudify-cosmo/cloudify-system-tests', 'circle'],
        ['cloudify-cosmo/cloudify-plugin-template', 'circle'],
        ['cloudify-cosmo/cloudify-agent-packager', 'circle'],
        ['cloudify-cosmo/version-tool', 'circle'],
        ['cloudify-cosmo/cloudify-nodecellar-example', 'circle'],
        ['cloudify-cosmo/cloudify-manager-blueprints', 'circle'],
        ['cloudify-cosmo/packman', 'circle'],
        ['cloudify-cosmo/repex', 'circle'],
        ['cloudify-cosmo/cloudify-agent', 'circle'],
        ['hello-world-example', 'circle', 'cloudify-cosmo/cloudify-manager-blueprints', 'master'],
        ['Bootstrap Sanity', 'travis', 'cloudify-cosmo/cloudify-manager-blueprints', 'bootstrap-sanity']
    ];
    repos = _.map(repositories, function (name) {
        var repoName = name[0];
        var title = name[0];
        var ci = name[1];
        var branch = 'master';
        if (name.length > 2) {
            var title = name[0];
            var ci = name[1];
            var repoName = name[2];
            var branch = name[3];
        }
        
        var link = (ci == 'travis') ? 'https://api.travis-ci.org/repos/' + repoName + '/builds?event_type=push' :
        'https://circleci.com/api/v1/project/' + repoName + '/tree/master'
        
        return {
            'name': repoName,
            'displayName': title.replace('cloudify-cosmo/', ''),
            'apiLink': link,
            'buildLink': '',
            'state': 'uninitialized',
            'customText': '0s',
            'buildsPage': 0,
            'branch': branch,
            'ci': ci
        };
    });

    function isBuildBranch(branchName) {
        var regexp = new RegExp(/^\d*\.\d*.*/);
        return regexp.exec(branchName) != null && branchName.lastIndexOf('build') == -1;
    }

    function processRepoResponse(repo, response) {
        if (repo.ci == 'travis') {
            var builds = _.filter(response.data, function (build) {
                return (build.branch == repo.branch) && !(build.state === 'finished' && build.duration == 0);
            });
            
            sortBuildsByDate(builds);

            if (builds.length == 0) {
                checkNextBuilds(repo, response)
            }
            var build = builds[0];
            repo.branch = build.branch;
            repo.buildLink = 'https://travis-ci.org/' + repo.name + '/builds/' + build.id
            repo.state = build.state;
            if (build.state == 'created') {
                repo.customText = '0s';
            } else if (build.state == 'started') {
                var startedAt = new Date(build.started_at);
                var currentTime = new Date();
                repo.customText = Math.max(0, Math.round((currentTime.getTime() - startedAt.getTime()) / 1000)) + 's';
            } else if (build.state == 'finished' && build.result != 0) {
                repo.state = 'failed'
            }
            return build;
        }
        if (repo.ci == 'circle') {
            var builds = _.filter(response.data, function (build) {
                return (build.branch == repo.branch || build.vcs_tag == 'bootstrap-sanity') && !(build.lifecycle === 'finished' && build.build_time_millis == 0);
            });
            
            sortBuildsByDate(builds);
            
            if (builds.length == 0) {
                checkNextBuilds(repo, response)
            }
            var build = builds[0];
            repo.branch = build.branch;
            repo.buildLink = 'https://circleci.com/gh/' + repo.name + '/' + build.build_num
            repo.state = build.lifecycle;
            if (build.lifecycle == 'scheduled') {
                repo.customText = '0s';
            } else if (build.lifecycle == 'running') {
                var startedAt = new Date(build.start_time);
                var currentTime = new Date();
                repo.customText = Math.max(0, Math.round((currentTime.getTime() - startedAt.getTime()) / 1000)) + 's';
            } else if (build.lifecycle == 'finished' && build.status == 'failed') {
                repo.state = 'failed'
            }
            return build;
        }
    }

    $scope.data = repos.sort(function (x, y) {
        return x.displayName.localeCompare(y.displayName);
    });
    $scope.builds = [];
    $scope.updatedAt = getCurrentTime();
    function loadStatus(repo) {
        if (repo.ci == 'travis') {
            $log.info('making request to: ' + repo.apiLink);
            var timeout = 60000;
            $http.get(repo.apiLink).then(function (response) {
                var build = processRepoResponse(repo, response);
                if (build) {
                    $log.info('build: ' + JSON.stringify(build));
                    if (build.state == 'started' || build.state == 'created') {
                        timeout = 10000;
                    }
                }
                $scope.data = repos.filter(function (r) {
                    return r.state != 'not-running';
                });
                $scope.builds = data.filter(function (r) {
                    return isBuildBranch(r.branch);
                });
                $scope.updatedAt = getCurrentTime();
                $timeout(function () {
                    loadStatus(repo);
                }, timeout);
                
            }, function (result) {
                $log.error('unable to get results for: ' + repo);
                $timeout(function () {
                    loadStatus(repo);
                }, timeout);
            });
        }
        if (repo.ci == 'circle') {
            $log.info('making request to: ' + repo.apiLink);
            var timeout = 60000;
            $http.get(repo.apiLink).then(function (response) {
                var build = processRepoResponse(repo, response);
                if (build) {
                    $log.info('build: ' + JSON.stringify(build));
                    if (build.lifecycle == 'running' || build.lifecycle == 'scheduled') {
                        timeout = 10000;
                    }
                }
                $scope.data = repos.filter(function (r) {
                    return r.state != 'not_run';
                });
                $scope.builds = repos.filter(function (r) {
                    return r.state != 'not_run' && isBuildBranch(r.branch);
                });
                $scope.updatedAt = getCurrentTime();
                $timeout(function () {
                    loadStatus(repo);
                }, timeout);
            }, function (result) {
                $log.error('unable to get results for: ' + repo);
                $timeout(function () {
                    loadStatus(repo);
                }, timeout);
            });
        }
    }

    for (var i = 0; i < repositories.length; i++) {
        loadStatus(repos[i]);
    }
}

function sortBuildsByDate(builds) {
    builds.sort(function(x,y) {
                if (x.started_at == null) {
                    return -1;
                } else if (y.started_at == null) {
                    return 1;
                }
                var xStartedAt = new Date(x.started_at);
                var yStartedAt = new Date(y.started_at);
                if (xStartedAt < yStartedAt) {
                    return 1;
                } else if (yStartedAt < xStartedAt) {
                    return -1;
                }
                return 0;
            });
    return builds;
}

function getCurrentTime() {
    var date = new Date();
    var options = {
        hour12: false,
    };
    return date.toLocaleTimeString('en-us', options).substring(0, 5);
}

function checkNextBuilds(repo, response){
    if (response.data.length > 0 && repo.buildsPage < 10) {
        repo.buildsPage += 1;
        lastNumber = response.data[response.data.length - 1].number;
        paramConcatIndex = repo.apiLink.lastIndexOf("&")
    if (paramConcatIndex != -1)
        repo.apiLink = repo.apiLink.substring(0, paramConcatIndex);
    repo.apiLink += "&after_number=" + lastNumber;
    loadStatus(repo);
    }
    repo.state = 'not_running';
    return null;
}