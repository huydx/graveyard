import { Link } from "react-router-dom";
import RubyHtml from "../components/RubyHtml";
import { paths } from "../lib/paths";
import * as L from "../lib/uiLabelsRuby";

export default function SansuHomePage() {
  return (
    <div className="sansu-placeholder">
      <RubyHtml as="h2" className="sansu-placeholder-title" html={L.sansuPageTitle} />
      <p className="sansu-placeholder-lead">
        <RubyHtml html={L.sansuPageLead} />
      </p>
      <Link to={paths.home} className="btn btn-ghost sansu-back">
        <RubyHtml html={L.backToAppHub} />
      </Link>
    </div>
  );
}
