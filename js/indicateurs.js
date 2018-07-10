var columns = [
    { name: "Nom", key: "name" },
    { name: "Service", key: "service" },
    { name: "Etat", key: "etat" },
    { name: "Date de début", key: "start_date" },
    { name: "Date de fin", key: "end_date" },
    { name: "Priorité", key: 'priorite' },
    { name: "Domaine", key: 'domaine' },
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
  domaine: {
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
  service: {
    "inconnu": "gray",
    "DSIUN-SAS": '#4572A7', 
    "DSIUN-SIS": '#AA4643', 
    //'#89A54E', '#80699B', '#3D96AE', '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92']"    
  },
};

function groupBy(xs, key) {
    return xs.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
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
    if (projet.start_year <= year && 
        year <= (close_year ? min_no_falsy(projet.end_year, close_year) - 1 : projet.end_year)) {
        return "En cours";
    }
    if (projet.end_year && projet.end_year <= year &&
        (today_year === year ? 
          projet.etat === 'En retard' :
          year <= min_no_falsy(close_year, today_year))) {
        return "En retard";
    }
    if (close_year) {
        return close_year === year ? projet.etat : null;
    }
    if (year === projet.start_year && projet.etat === 'Futur') {
        return "Futur";
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
        chart: { type: 'pie', width: 400, height: 300 },
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
            if (wanted && projet[filterKey] !== wanted) return false;
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
        projet.start_year = sqlDateToYear(projet.start_date);
        projet.end_year = sqlDateToYear(projet.end_date);
        projet.close_year = projet.is_active ? null : epochToYear(projet.last_modified);
        projet.year_etat = undefined;
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
        columns: columns,
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
        this.pieChart_helper('service', 'Projets par services');
        this.pieChart_helper('domaine', 'Projets par domaine fonctionnel');
        histogrammeGeneral(this.startYear, this.endYear, projets);
      },
      pieChart_helper: function (kind, title, kind_for_nb, all) {
        var filterKeys = this.filterKeys;
        var filterKeysIgnoreKind = { ...this.filterKeys, [kind]: '' };
        var projets = filter_projets(this.projets, filterKeysIgnoreKind, this.filterAll, this.startYear, this.endYear);

        if (!all) all = groupBy(this.projets, kind);
        var nbs = groupBy(projets, kind_for_nb || kind);

        pieChart({ 
            eltId: 'pie_' + kind + 's', 
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
    },
  })
  
