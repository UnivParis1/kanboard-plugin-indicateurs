var columns_common = [
    { name: "Nom", key: "name" },
    { name: "Service", key: "services", to_text: array_to_text },
    { name: "Etat", key: "etat" },
    { name: "Date de début", key: "start_date" },
    { name: "Date de fin", key: "end_date" },
    { name: "Priorité", key: 'priority_default' },
];

var columns_html = columns_common.concat([
    { name: "Domaine", key: 'category_DF', to_text: array_to_text },
]);

var columns_csv = columns_common.concat([
    { name: "Avancement", key: "progress", to_csv: to_integer(100) },
    { name: "Membres", key: "roles_users", to_csv: roles_users_to_text },
    { name: "Description", key: "description" },
]);

var priorites = [ 
    'Basse', 
    'Normale', 
    'Haute',
    'Très haute',
];

var colors = {
  etat: {
    "En attente": 'gray',
    "Futur": 'orange',
    "En cours": 'blue',
    "En retard": 'red',
    "Terminé": 'green',
    "Abandonné": 'purple',
  },
  category_DF: {
    "inconnu": "gray",
    "Transverse": '#2f7ed8',
    "Recherche": '#0d233a',
    "Pédagogie": '#8bbc21',
    "RH": '#910000',
    "Sécurité": '#1aadce',
    "Communication": '#492970',
    "Patrimoine": '#f28f43',
    "Scolarité": '#77a1e5',
    // '#c42525''#a6c96a',
  },
  services: {
    "inconnu": "gray",
    "DSIUN-SAS": '#4572A7', 
    "DSIUN-SIS": '#AA4643', 
    //'#89A54E', '#80699B', '#3D96AE', '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92']"    
  },
};

function to_integer(unratio) {
    return function (n) {
        return Math.round(n * 100);
    }
}

function array_to_text(l) {
    return (l || []).length ? l.join(', ') : '';
}

function roles_users_to_text(roles_users) {
    return (roles_users || []).filter(function (role_users) {
        return (role_users.users || []).length;
    }).map(function (role_users) {
        return role_users.name + " : " + role_users.users.join(", ");
    }).join("\n");
}

function makeObject(key, val) {
    let o = {};
    o[key] = val;
    return o;
}

function groupBy_may_duplicate(xs, key) {
    return xs.reduce(function(rv, x) {
        var names = x[key];
        if (!Array.isArray(names)) names = [names || '<i>inconnu</i>'];
        names.forEach(name => {
            (rv[name] = rv[name] || []).push(x);
        });
        return rv;
    }, {});
}

function group_by_category_prefix(project) {
    project.categories.forEach(function (cat) {
        var m = cat.match(/^([A-Z]+)_(.*)/);
        if (m) {
            var cat_field = "category_" + m[1];
            if (!project[cat_field]) project[cat_field] = [];
            project[cat_field].push(m[2]);
        }
    });
}

function min_no_falsy(a, b) {
    return a && b ? Math.min(a, b) : (a || b);
}

function toLowerCaseIfString(v) {
    return typeof v === "string" ? v.toLowerCase() : v;
}

function sqlDateToYear(date) {
    return date && new Date(date).getFullYear();
}
function epochToYear(epoch) {
    return epoch && new Date(epoch * 1000).getFullYear();
}

function row_toCSV(row) {
    return row.map(function (val) {
        return val.match(/[",\n]/) ? '"' + val.replace(/"/g, '""') + '"' : val;
    }).join(',') + "\n"
}
function rows_toCSV(rows) {
    return rows.map(row_toCSV).join('');
}

function toCSV(objects, columns) {
    var titles = columns.map(function (column) { return column.name });
    var rows = objects.map(function (o) {
        return columns.map(function (column) {
            var val = o[column.key];
            if (column.to_csv) val = column.to_csv(val);
            return val ? "" + val : "";
        });
    });
    return rows_toCSV([titles].concat(rows));
}

function computeannees(startYear, endYear) {
    var r = [];
    var year;
    for (year = startYear; year <= endYear; year++){
        r.push(year);
    }
    return r;
}

function initHistogramme(annees) {
    var r = {};
    $.each(colors.etat, function (etat, color) {
        if (etat === 'En attente') return;
        var status_data = annees.map(function (annee) { return 0; });
        r[etat] = { name: etat, color: color, data: status_data };
    });
    return r;
}

var today_year = new Date().getFullYear();

function computeHistogramme(startYear, endYear, projets) {
    var annees = computeannees(startYear, endYear);
    var series = initHistogramme(annees);
    projets.forEach(function (projet) {
        annees.forEach(function (annee, i) {
            var year_etat = compute_past_or_future_project_state(projet, annee);
            if (year_etat) {
                //console.log(annee + ": adding  " + projet.name + " with state " + year_etat);
                series[year_etat]['data'][i]++;
            }
        })
    });
    return { annees: annees, series: Object.values(series) };
}

function compute_past_or_future_project_state(projet, year) {
    if (!projet.start_year) return null;

    var close_year = projet.close_year;
    if (projet.end_year && projet.end_year <= year &&
        (today_year === year ? 
          projet.etat === 'En retard' :
          year <= min_no_falsy(close_year, today_year))) {
        return "En retard";
    }
    if (year === projet.start_year && projet.etat === 'Futur') {
        return "Futur";
    }
    if (projet.start_year <= year && 
        year <= (close_year ? min_no_falsy(projet.end_year, close_year) - 1 : projet.end_year)) {
        return "En cours";
    }
    if (close_year) {
        return close_year === year ? projet.etat : null;
    }
    return null;
}


var _charts = {};

function cachedChart(eltId, params) {
    var chart = _charts[eltId];
    if (!chart) {
        chart = Highcharts.chart(eltId, params);
    } else {
        chart.setTitle(params.title);
        params.series.forEach(function (serie, i) {
            chart.series[i].setData(serie.data);
        });
        if (params.xAxis) chart.xAxis[0].setCategories(params.xAxis.categories);
    }
    _charts[eltId] = chart;
}


function pieChart(params) {
    cachedChart(params.eltId, {
        chart: { type: 'pie', width: 430, height: 300 },
        title: { text: params.title },
        plotOptions: {
            pie: {
                size: 150,
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    format: '<b>{point.name}</b> ({point.y})',
                },
                events: {
                    click: function (event) {
                        params.onclick(event.target.point.name);
                    }
                }
            },
        },
        series: [{
            name: 'Nombre',
            colorByPoint: true,
            data: params.series_data,
        }]
    });
}

function histogrammeGeneral(startYear, endYear, projets) {
    var histo = computeHistogramme(startYear, endYear, projets)

    cachedChart('histogrammeGeneral', {
        chart: { type: 'column' },
        title: { text: 'Vision globale des projets passés et futurs' },
        xAxis: {
            categories: histo.annees,
        },
        yAxis: {
            min: 0,
            title: { text: 'Nombre de projets' },
        },
        legend: {
            align: 'right', verticalAlign: 'top',
            borderColor: '#CCC', borderWidth: 1,
        },
        tooltip: {
            headerFormat: '<b>{point.x}</b><br/>',
            pointFormat: '{series.name}: {point.y}<br/>Total: {point.stackTotal}'
        },
        plotOptions: {
            column: { 
                stacking: 'normal',
                events: {
                    legendItemClick: function () {
                        return false; // <== returning false will cancel the default action
                    }
                }
            },
        },
        series: histo.series
    });
}

function filter_projets(projets, filterKeys, filterAll, startYear, endYear) {
    filterAll = filterAll.toLowerCase()
    return projets.filter(function (projet) {
        for (filterKey in filterKeys) {
            var wanted = filterKeys[filterKey];
            if (wanted) {
                if (wanted === '<i>inconnu</i>') {
                    wanted = undefined;
                }
                var val = projet[filterKey];
                var matches = Array.isArray(val) ? val.includes(wanted) : val === wanted;
                if (!matches) return false;
            }
        }
        if (endYear && projet.start_year && projet.start_year > endYear) return false;
        if (startYear && projet.end_year && projet.end_year < startYear) return false;

        return !filterAll || Object.keys(projet).some(function (key) {
            return String(projet[key]).toLowerCase().indexOf(filterAll) > -1
        })
    });
}

function computeProjets() {
    return params.projets.map(function (projet) {
        [ 'last_modified', 'is_active' ].forEach(function (field) {
            projet[field] = parseInt(projet[field]);
        });
        projet.start_year = sqlDateToYear(projet.start_date);
        projet.end_year = sqlDateToYear(projet.end_date);
        projet.close_year = projet.is_active ? null : epochToYear(projet.last_modified);
        projet.year_etat = undefined;
        group_by_category_prefix(projet);
        return projet;
      });
}

Vue.component('etat-with-color', {
    props: [ 'etat' ],
    template: "<span :style='{ color: color }'>{{etat}}</span>",
    computed: {
        color: function() {
            return colors.etat[this.etat];
        },
    },
});

new Vue({
    el: '#vueMain',
    propsData: {
        columns: columns_html,
        projets: computeProjets(),
        filterAll: '',
    },
    props: {
        projets: Array,
        columns: Array,
        filterAll: String
    },
    data: function () {
      var sortOrders = {}
      var filterKeys = {};
      this.columns.forEach(function (col) {
        sortOrders[col.key] = 1
        filterKeys[col.key] = '';
      })
      var currentYear = new Date().getFullYear();
      return {
        startYear: currentYear - 4,
        endYear: currentYear + 4,
        currentYear: undefined, // no currentYear means precisely today
        filterKeys: filterKeys,
        sortKey: 'name',
        sortOrders: sortOrders
      }
    },
    mounted: function() {
        this.displayCharts();
    },
    watch: {
      filteredData: 'delayedDisplayCharts',
      endYear: function (year) { 
          // by default, "etat" is exactly today. If user modifies "endYear", we display "etat" at "endYear"
          this.currentYear = year;
      },
    },
    computed: {
      priorites: function () { return priorites },
      minAllowedYear: function () { return 2010 },
      maxAllowedYear: function () { return 2040 },
      filteredData: function () {
            data = filter_projets(this.projets, this.filterKeys, this.filterAll, this.startYear, this.endYear);
            if (this.currentYear) {
                var currentYear = this.currentYear;
                data.forEach(function (projet) {
                    projet.year_etat = compute_past_or_future_project_state(projet, currentYear) || '';
                });
            }
            if (this.sortKey) {
                var sortKey = this.sortKey
                var order = this.sortOrders[sortKey] || 1
                if (sortKey === "etat") sortKey = this.currentYear ? "year_etat" : "progress";
                data = data.slice().sort(function (a, b) {
                a = toLowerCaseIfString(a[sortKey])
                b = toLowerCaseIfString(b[sortKey])
                return (a === b ? 0 : a > b ? 1 : -1) * order
                })
            }
            return data;
        }
    },
    methods: {
      sortBy: function (key) {
        this.sortKey = key
        this.sortOrders[key] = this.sortOrders[key] * -1
      },
      delayedDisplayCharts: function () {
        var that = this;
        if (this._delayedDisplayCharts) clearTimeout(this._delayedDisplayCharts);
        this._delayedDisplayCharts = setTimeout(function () {
            that.displayCharts();
            KB.tooltip(); // enable tooltips, otherwise only done on page load (cf js/core/tooltip.js)
        }, 300);
      },
      displayCharts: function () {
        var projets = this.filteredData;
        this.pieChart_helper('etat', 'États des projets' + (this.currentYear ? ' en ' + this.currentYear : '') + ' (' + projets.length + ')',
                             this.currentYear ? 'year_etat' : 'etat', colors.etat);
        this.pieChart_helper('services', 'Projets par service');
        this.pieChart_helper('category_DF', 'Projets par domaine fonctionnel');
        histogrammeGeneral(this.startYear, this.endYear, projets);
      },
      pieChart_helper: function (kind, title, kind_for_nb, all) {
        var filterKeys = this.filterKeys;
        var filterKeysIgnoreKind = $.extend({}, this.filterKeys, makeObject(kind, ''));
        var projets = filter_projets(this.projets, filterKeysIgnoreKind, this.filterAll, this.startYear, this.endYear);

        if (!all) all = groupBy_may_duplicate(this.projets, kind);
        var nbs = groupBy_may_duplicate(projets, kind_for_nb || kind);

        pieChart({ 
            eltId: 'pie_' + kind + (kind.match(/s$/) ? '' : 's'), 
            title: title,
            series_data: $.map(all, function (_, name) {
                var nb = nbs[name] && nbs[name].length || 0;
                return { name: name, y: nb, color: colors[kind][name], selected: filterKeys[kind] && name === filterKeys[kind] };
            }),
            onclick: function (name) {
                filterKeys[kind] = filterKeys[kind] === name ? '' : name;
            },
        });
      },
      exportCSV: function (event) {
        var dynamic_columns = {};
        this.filteredData.forEach(function(project) {
            var key;
            for (key in project) {
                var m = key.match(/^category_(.*)/);
                if (m) dynamic_columns[key] = { key: key, name: m[1] };
            }
        });
        var csv = toCSV(this.filteredData, columns_csv.concat(Object.values(dynamic_columns)));
        var uri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
        var link = document.createElement("a");
        link.setAttribute("href", uri);
        link.setAttribute("download", "projets.csv");
        event.target.parentElement.appendChild(link); // needed on Firefox, but not Chromium.
        link.click();
      },    
    },
  })
  
