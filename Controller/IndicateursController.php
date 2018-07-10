<?php
namespace Kanboard\Plugin\Indicateurs\Controller;
use Kanboard\Controller\BaseController;

class IndicateursController extends BaseController
{
    static $roleForService = 'Directeur de projet';
    static $group2service_regexp = '/Chef de service (.*)/';

    static $tasksProgress = [
        'En attente' => 0,
        'Prêt' => 0,
        'En cours' => 0.2,
        'Terminé' => 1,
    ];

    static $priorites = [ 
        'Basse', 
        'Normale', 
        'Haute',
        'Très haute',
    ];

    public function index()
    {
        $projets = [];

        foreach ($this->projectModel->getAll() as $project) {
            $etat = $this->computeEtatProjet($project);
            $owner = $this->userModel->getById($project['owner_id']);
            $categories = array_map(function ($cat) { return $cat['name']; }, $this->categoryModel->getAll($project['id']));

            $roles = array_merge([ "owner" => "Responsable du projet" ], $this->projectRoleModel->getList($project['id']));
            unset($roles['project-viewer']);

            $name_link = $this->helper->url->link($project["name"], 'BoardViewController', 'show', array('project_id' => $project['id']), false, '', '', true);

            $tooltip_users = $this->template->render('project_user_overview/tooltip_users', array(
                'users' => array_merge([ "owner" => [ $owner['name'] ] ], $this->projectUserRoleModel->getAllUsersGroupedByRole($project['id'])),
                'roles' => $roles,
            ));
            $tooltips = $this->helper->app->tooltipHtml($tooltip_users, 'fa-users');
            if (!empty($project['description']))
                $tooltips .= $this->helper->app->tooltipMarkdown($project['description']);

            $projets[] = array_merge([
                'etat' => $etat,
                'categories' => $categories,
                'progress' => $this->computeProgress($project),
                'service' => $this->computeService($project),
                'domaine' => self::getDomaine($categories),
                "priorite" => self::$priorites[$project['priority_default']],
                "name_link" => $name_link,
                "tooltips" => $tooltips,
            ], $project);
        }

        $this->response->html($this->helper->layout->pageLayout('Indicateurs:indicateurs', array(
            'title' => t("Indicateurs"),
            'params' => [ 
                'priorites' => self::$priorites,
                'projets' => $projets,
            ],
        )));
    }

    function computeService($project) {
        foreach ($this->projectGroupRoleModel->getGroups($project['id']) as $e) {
            if ($e['role'] === self::$roleForService) {
                if (preg_match(self::$group2service_regexp, $e['name'], $m)) return $m[1];
                // fallback on raw name
                return $e['name'];
            }
        }
        return 'inconnu';
    }

    function computeProgress($project) {
        $progress = 0;
        $total = 0;
        foreach ($this->taskDistributionAnalytic->build($project['id']) as $by_task) {
            $progress += self::$tasksProgress[$by_task['column_title']] * $by_task['nb_tasks'];
            $total += $by_task['nb_tasks'];
        }
        return $total ? $progress / $total : null;
    }

    function computeEtatProjet($project) {
        if (!$project['is_active']) return "Terminé";
        if (!$project['start_date']) return "En attente";

        $now = new \DateTime(date("Y-m-d"));
        $startDate = new \DateTime($project['start_date']);
        $endDate = new \DateTime($project['end_date']);

        if ($startDate > $now) return "Futur";
        if ($project['end_date'] && $endDate < $now) return "En retard";

        return "En cours";
    }

    static function getDomaine($categories) {
        foreach ($categories as $cat) {
            if (preg_match("/DF_(.*)/", $cat, $m)) return $m[1];
        }
        return 'inconnu';
    }


}