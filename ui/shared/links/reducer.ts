import { Logout } from 'shared/authentication/actions';
import {
  CreateLinks,
  FETCH_LINKS_FAILURE,
  FETCH_LINKS_REQUEST,
  FETCH_LINKS_SUCCESS,
  LinkActions,
  RemoveLink,
} from 'shared/links/actions';
import LinksState from 'shared/links/state';

export default function reducer(state: LinksState = new LinksState(), action: LinkActions): LinksState {
  switch (action.type) {
    case FETCH_LINKS_REQUEST:
      return {
        ...state,
        loading: true,
      };
    case FETCH_LINKS_FAILURE:
      return {
        ...state,
        loading: false,
      };
    case FETCH_LINKS_SUCCESS:
      return {
        ...state,
        loaded: true,
        loading: false,
        items: state.items.merge(action.payload),
      };
    case CreateLinks.Success:
      return {
        ...state,
        loaded: true,
        loading: false,
        items: state.items.set(action.payload.linkId, action.payload),
      };
    case RemoveLink.Request:
      return {
        ...state,
        loading: true,
      };
    case RemoveLink.Failure:
      return {
        ...state,
        loading: false,
      };
    case RemoveLink.Success:
      return {
        ...state,
        loaded: true,
        loading: false,
        items: state.items.remove(action.payload.link.linkId),
      };
    case Logout.Success:
      return new LinksState();
    default:
      return state;
  }
}
