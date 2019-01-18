<?php
namespace Kanboard\Plugin\Indicateurs\Controller;
use Kanboard\Controller\BaseController;

class IndicateursController extends BaseController
{
    static $roleForService = 'Directeur de projet';
    static $group2service_regexp = '/^(?:Chef de service|Adjoint au chef de service|Responsable administratif|Directeur) (.*)/';

    static $tasksProgress = [
        'En attente' => 0,
        'Prêt' => 0,
        'En cours' => 0.2,
        'Terminé' => 1,
    ];

    public function index()
    {
        $projets = [];

        $projectIds = array_keys($this->projectGroupRoleModel->getProjectsByUser($this->userSession->getId()));
        foreach ($this->projectModel->getAllByIds($projectIds) as $project) {
            if ($project['is_private']) continue;

            $etat = $this->computeEtatProjet($project);
            $owner = $this->userModel->getById($project['owner_id']);
            $categories = array_map(function ($cat) { return $cat['name']; }, $this->categoryModel->getAll($project['id']));

            $role2users = array_merge([ "owner" => [ $owner['name'] ] ], $this->projectUserRoleModel->getAllUsersGroupedByRole($project['id']));
            $roles = array_merge([ "owner" => "Responsable fonctionnel" ], $this->projectRoleModel->getList($project['id']));
            unset($roles['project-viewer']);

            $name_link = $this->helper->url->link($project["name"], 'BoardViewController', 'show', array('project_id' => $project['id']), false, '', '', true);

            $tooltip_users = $this->template->render('project_user_overview/tooltip_users', array('users' => $role2users, 'roles' => $roles));
            $tooltips = $this->helper->app->tooltipHtml($tooltip_users, 'fa-users');
            if (!empty($project['description']))
                $tooltips .= $this->helper->app->tooltipMarkdown($project['description']);

            $roles_users = [];
            foreach ($roles as $key => $name) {
                $users = array_filter(array_values($role2users[$key])); // we want plain user names + remove nulls
                $roles_users[] = [ key => $key, name => $name, users => $users ];
            }

            $projets[] = array_merge([
                'etat' => $etat,
                'categories' => $categories,
                'progress' => $this->computeProgress($project),
                'services' => $this->computeServices($project),
                "name_link" => $name_link,
                "roles_users" => $roles_users,
                "tooltips" => $tooltips,
            ], $project);
        }

        $this->response->html($this->helper->layout->pageLayout('Indicateurs:indicateurs', array(
            'title' => t("Indicateurs"),
            'params' => [ 
                'projets' => $projets,
            ],
        )));
    }

    function computeServices($project) {
        $l = [];
        foreach ($this->projectGroupRoleModel->getGroups($project['id']) as $e) {
            if ($e['role'] === self::$roleForService) {
                if (preg_match(self::$group2service_regexp, $e['name'], $m)) $l[] = $m[1];
            }
        }
        return array_unique($l);
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

}